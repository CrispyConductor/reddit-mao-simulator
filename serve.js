'use strict';

const express = require('express');
const runInputs = require('./run-inputs');
const pasync = require('pasync');
const fs = require('fs');

const postBayesFile = 'data/posts/bayes.json';
const postAnnFile = 'data/posts/neural_net.ann';
const postResultsFile = 'data/posts/train_results.json';
const commentBayesFile = 'data/comments/bayes.json';
const commentAnnFile = 'data/comments/neural_net.ann';
const commentResultsFile = 'data/comments/train_results.json';

let postResults, commentResults;

try {
	postResults = JSON.parse(fs.readFileSync(postResultsFile));
	commentResults = JSON.parse(fs.readFileSync(commentResultsFile));
} catch (err) {}

const app = express();
app.set('views', './views');
app.set('view engine', 'pug');

app.get('/', function(req, res) {
	let templateParams = {
		commentOverallAccuracy: commentResults ? Math.floor((1 - commentResults.bitFailFrac) * 100) + '%' : 'Unknown',
		postOverallAccuracy: postResults ? Math.floor((1 - postResults.bitFailFrac) * 100) + '%' : 'Unknown'
	};
	if (req.query.go) {
		templateParams.curVal_body = req.query.body;
		templateParams.curVal_author = req.query.author;
		templateParams.curVal_authorFlair = req.query.authorFlair;
		templateParams.curVal_createTime = req.query.createTime;
		templateParams.curVal_isComment = !!req.query.isComment;
		let isComment = !!req.query.isComment;
		let data = {
			body: isComment ? req.query.body : undefined,
			title: isComment ? undefined : req.query.body,
			author: req.query.author || '',
			author_flair_text: req.query.author_flair_text,
			created_utc: Math.floor(new Date(req.query.createTime).getTime() / 1000)
		};
		if (!data.created_utc || isNaN(data.created_utc)) data.created_utc = Math.floor(new Date().getTime() / 1000);
		let outputs = runInputs.run(data, isComment);
		templateParams.bannedProbability = parseFloat(outputs[0].toFixed(2));
		console.log(isComment, data, outputs[0]);
	} else {
		templateParams.curVal_isComment = true;
		templateParams.curVal_createTime = new Date().toISOString();
	}
	res.render('index', templateParams);
});

const port = 7190;

runInputs.init().then(() => {
	app.listen(port, () => console.log('Listening on ' + port));
}).catch(pasync.abort);

