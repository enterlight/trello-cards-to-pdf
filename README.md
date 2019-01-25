# Trello Cards to PDF Converter

Uses [Node wrapper for Trello’s HTTP API][node-trello-doc] and Puppeteer to Convert Trello Cards from all the Boards of an Organization to PDF.  Enjoy.
If you use this, please keep me updated on your project!

[View Trello’s API documentation online][apidocs].

[node-trello-doc]: https://github.com/adunkman/node-trello/blob/master/README.md
[apidocs]: https://trello.com/docs/


## Install 
```
npm install node-trello
npm install puppeteer
```

### Getting your key and token
* [Generate your developer key][devkey] this key is injected into the node-trello constructor

### Get your organization ID
This key is used to retreive all the Trello Boards in your oganization.  To get this id, sign in to Trello and select Show Menu->More->Print and Export->Export as JSON

[devkey]: https://trello.com/1/appKey/generate

### Replace in code

```javascript

var trello = new Trello('your_key', 'your_token');
var organizationID = 'your_organizationID';

```

## Run
node TrelloCardsToPDF.js


## License

Released under [MIT](https://github.com/adunkman/node-trello/blob/master/LICENSE.md).