

const puppeteer = require('puppeteer');
const Trello = require("node-trello");

var trello = new Trello('your_key', 'your_token');
var organizationID = 'your_organizationID';
var fs = require('fs');


var team = {
    boards : [],
    labels : [],
    members : [],
    cards: []
};


// Promise that gets all cards attached to a board
var getAllCardsInfo = function(board) {


    return new Promise( (resolve, reject) => {

        trello.get(`/1/boards/${board.id}/cards/open`, {fields : 'name,idBoard,idMembers,idLabels,url,idStickers'}, function (err, data) {
            if (err) {
                reject(err);
            }

            else {
                resolve(data);
            }
        });
    });
};


// Promise that gets all labels attached to a board
var getAllLabelsInfo = function(board) {


    return new Promise( (resolve, reject) => {

        trello.get(`/1/boards/${board.id}/labels`, {limit : 1000, fields : 'name,color'}, function (err, data) {
            if (err) {
                reject(err);
            }

            else {
                resolve(data);
            }
        });
    });
};


// Promise that gets all stickers attached to a card
var getStickersInfo = function(card) {


    return new Promise( (resolve, reject) => {

        trello.get(`/1/cards/${card.id}/stickers`, {fields : 'image'}, function (err, data) {
            if (err) {
                reject(err);
            }

            else {

                resolve({
                    cardId      : card.id,
                    stickers    : data
                });
            }
        });
    });
};



// Promise that gets all members of an organization
var getAllMembersInfo = new Promise( (resolve, reject) => {

    trello.get(`/1/organization/${organizationID}/members`, {limit : 1000, fields : 'initials,fullName'}, function (err, data) {
        if (err) {
            reject(err);
        }

        else {
            resolve(data);
        }
    });
});


/**
 * Get all boards that belong to organization
 */
trello.get(`/1/organizations/${organizationID}/boards`, {}, function(err, data) {

    if (err) {
        throw err;
    }


    var boards = data;

    boards.forEach(board => {
        team.boards[board.id] = {
            id          : board.id,
            name        : board.name,
            url         : board.url,
        };
    });

    // console.log(team.boards);
    // return;


    var cardsPromises = boards.map(getAllCardsInfo);
    var labelsPromises = boards.map(getAllLabelsInfo);

    var stickerPromises = [];


    Promise.all(cardsPromises)
        .then(function (results) {

            /* All the resolves getAllCardsInfo */

            results.forEach(cardsInfo => {

                cardsInfo.forEach(card => {

                    card.warning = false;

                    /* Once we have a card, we can copy it into our main structure */
                    team.cards[card.id] = Object.assign({}, card);

                    /* Once we have the card, we can start fetching all the stickers for that card) */
                    stickerPromises.push(getStickersInfo(card));
                });
            });

            /* tag the cards that have a warning sticker */
            Promise.all(stickerPromises).then(results => {

                results.forEach(stickerInfo => {
                    // console.log(stickerInfo);
                    stickerInfo.stickers.forEach(sticker => {
                        if (sticker.image.match(/warning/)) {
                            team.cards[stickerInfo.cardId].warning = true;
                            return true;
                        }
                        return false;
                    });
                });
            });

            /* Once we have all the labels for all the boards, we can copy them into our main structure */
            Promise.all(labelsPromises)
                .then(function (results) {

                    results.forEach(labelsInfo => {
                        labelsInfo.forEach(label => {
                            team.labels[label.id] = Object.assign({}, label);
                        });
                    });

                    /* Get all the members and copy them into our main structure */
                    getAllMembersInfo.then( membersInfo => {
                        membersInfo.forEach(member => {

                                team.members[member.id] = Object.assign({}, member);
                        });

                        /* Now, we can print the PDF */
                        visitAllUrls();
                    });

                })
                .catch(function (err) {
                    // Will catch failure of first failed promise
                    console.log("Failed:", err);
                });
        })
        .catch(function (err) {
            // Will catch failure of first failed promise
            console.log("Failed:", err);
        });
});


async function visitAllUrls() {


    var nameTag = '';
    var statusTag = '';

    const browser = await puppeteer.launch(/*{headless: false}*/);
    const page = await browser.newPage();

    await page.goto('https://trello.com/login', {waitUntil: 'networkidle2'});

    // Login
    await page.type('#user', 'SBHS.bulldog.robotics@gmail.com');
    await page.type('#password', 'bulldogs123!');
    await page.click('#login');
    await page.waitForNavigation();

    console.log(team.boards);



    /** PRINT all the boards */

    for(var id in team.boards) {


        var url = team.boards[id].url;
        await page.goto(url, {waitUntil: 'networkidle2'});

        /* With more time, I would restyle the board so the card lists appear side by side like they appear while not in print mode... */
        // await page.evaluate(
        //     `node = $('#classic-body');
        //     if (node) {
        //         node.css('background:color' , 'rgba(0, 0, 0, 0)');
        //     }`
        // );

        var m = url.match(/^http.+\/(.+)$/);
        await page.pdf({
            path: `${m[1]}.pdf`,
            displayHeaderFooter: true,
            headerTemplate: `<div style="margin-top:20px; margin-left:50px; text-align:left; font-size:12px;"><span class="header-1">Scrum Board for Project : ${team.boards[id].name}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="header-2"></span></div>`,
            footerTemplate: `<div class="pageNumber" style="width:100%; text-align:center; font-size:12px;"></div>`,
            printBackground: true,
            format: 'Letter',
            landscape: false,
            scale: 0.9,
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in'
            }
        });
    }


    // console.log(team.cards);
    // return;

    /** PRINT all the cards */

    for(var id in team.cards) {


        var url = team.cards[id].url;
        console.log(url);

        await page.goto(url, {waitUntil: 'networkidle2'});


        /* Add the name of the member on top of the cards */

        nameTag = `<div style="font-size: 18px;">Assigned To:&nbsp;&nbsp;&nbsp;`;
        team.cards[id].idMembers.forEach(id => {
           nameTag +=  `<span>${team.members[id].fullName}, `;
        });
        nameTag += '</span></div>';


        /* Check if there is a warning flag on the card */

        statusTag = `<div style="font-size: 18px;">Status:&nbsp;&nbsp;&nbsp;`;

        if ( !team.cards[id].warning ) {
            statusTag +=  `<span>Documented, thanks`;
        }
        else {
            statusTag += '<span style="color:red">Warning: Task has to be Documented.  Please see comments';
        }
        statusTag += '</span></div>';


        /* Make sure card details are showing and restyle to add status and name tags on the header.  Hide buttons and non informative links */

        await page.evaluate(
            `node = $('#classic > div.window-overlay > div > div > div > div.window-header.mod-card-detail-icons-smaller > div.window-title');
            if (node) {
                node.after('${statusTag}');
                node.after('${nameTag}');
            }
            node = $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div:nth-child(10) > div.window-module-title.window-module-title-no-divider > div > a.quiet.js-hide-details');
            if (node) {
                node.css('display' , 'none');
            }
            node = $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div:nth-child(10) > div.window-module-title.window-module-title-no-divider > div > a.quiet.js-show-details');
            
            if (node) {
                node.click();
                node.css('display' , 'none');
            }
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div.window-module.js-attachments-section.u-clearfix.mod-card-detail-icons-smaller > div.u-gutter > div > div > p > span.u-block.quiet.attachment-thumbnail-details-title-options > span:nth-child(3) > a > span').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div.window-module.js-attachments-section.u-clearfix.mod-card-detail-icons-smaller > div.u-gutter > div > div > p > span.u-block.quiet.attachment-thumbnail-details-title-options > span:nth-child(2) > a > span').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div.window-module.js-attachments-section.u-clearfix.mod-card-detail-icons-smaller > div.u-gutter > div > div > p > span.quiet.attachment-thumbnail-details-options > a.attachment-thumbnail-details-options-item.dark-hover.js-remove-cover').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div.window-module.js-attachments-section.u-clearfix.mod-card-detail-icons-smaller > div.u-gutter > p.js-show-with-attachments > a').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div:nth-child(10) > div.js-list-actions.mod-card-back > div.phenom.mod-comment-type > div.phenom-reactions > div.phenom-meta.quiet > span.js-hide-on-sending.middle > a.js-edit-action').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div:nth-child(10) > div.js-list-actions.mod-card-back > div.phenom.mod-comment-type > div.phenom-reactions > div.phenom-meta.quiet > span.js-hide-on-sending.middle > a.js-confirm-delete-action').css('display' , 'none');
            $('#classic > div.window-overlay > div > div > div > div.window-main-col.mod-card-detail-icons-smaller > div:nth-child(2) > div.window-module-title.window-module-title-no-divider > a').css('display' , 'none');
            $('a').css('text-decoration', 'none');`
        );


        var m = url.match(/^http.+\/(.+)$/);


        /**
         * I use the label on the card to sort the cards into different folders
         */

        /** For all the labels */
        for (var l = 0; l < team.cards[id].idLabels.length; l++) {

            var labelName = team.labels[team.cards[id].idLabels[l]].name;

            var destination = `.\\${labelName}`;

            if ( !fs.existsSync(destination) ){
                fs.mkdirSync(destination);
            }

            await page.pdf({
                path: `${destination}\\${m[1]}.pdf`,
                displayHeaderFooter: true,
                printBackground: true,
                format: 'Letter',
                landscape: false,
                scale: 0.9,
                headerTemplate : `<div style="margin-top:20px; margin-left:50px; text-align:left; font-size:12px;"><span class="header-1">Project: ${team.boards[team.cards[id].idBoard].name}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="header-2">Classification: ${labelName} Task</span></div>`,
                footerTemplate : `<div class="pageNumber" style="width:100%; text-align:center; font-size:12px;"></div>`,
                margin: {
                    top         : '1in',
                    right       : '0.5in',
                    bottom      : '1in',
                    left        : '0.5in'
                }
            });

            // return;

        }
    }

    browser.close();
}