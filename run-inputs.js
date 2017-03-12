const buildInputs = require('./input-generator').buildInputs;
const pasync = require('pasync');
const bayes = require('bayes');
const fanny = require('fanny');
const fs = require('fs');

const postBayesFile = 'data/posts/bayes.json';
const postAnnFile = 'data/posts/neural_net.ann';
const commentBayesFile = 'data/comments/bayes.json';
const commentAnnFile = 'data/comments/neural_net.ann';

let postBayes;
let postAnn;
let commentBayes;
let commentAnn;

function loadBayes(file) {
	let json = fs.readFileSync(file);
	let data = JSON.parse(json);
	let result = {};
	for (let key in data) {
		result[key] = bayes.fromJson(data[key]);
	}
	return result;
}

function init() {
	postBayes = loadBayes(postBayesFile);
	commentBayes = loadBayes(commentBayesFile);
	return Promise.resolve()
		.then(() => fanny.loadANN(postAnnFile))
		.then((ann) => postAnn = ann)
		.then(() => fanny.loadANN(commentAnnFile))
		.then((ann) => commentAnn = ann);
}

function run(data, isComment) {
	let inputs = buildInputs(data, isComment, isComment ? commentBayes : postBayes);
	let ann = isComment ? commentAnn : postAnn;
	let outputs = ann.run(inputs);
	return outputs;
}

module.exports = {
	init,
	run
};

