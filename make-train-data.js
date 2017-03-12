'use strict';


const fs = require('fs');
const zstreams = require('zstreams');
const pasync = require('pasync');
const getPath = require('objtools').getPath;
const isScalar = require('objtools').isScalar;
const buildInputs = require('./input-generator').buildInputs;
const mkdirp = require('mkdirp');
const path = require('path');

if (!process.argv[2] || !process.argv[3] || !process.argv[4]) throw new Error('Usage: make-train-data <ParsedDataFile> <OutputDirectory> <posts|comments>');

let numRecords = 0;

const targetType = (process.argv[4] === 'comments') ? 'comment' : 'post';
const numInputs = buildInputs({}, targetType === 'comment', {}).length;

let bayesClassifiers = {};

const outDir = process.argv[3];
const outDataFile = path.join(outDir, 'data.train');
const outBayesFile = path.join(outDir, 'bayes.json');

zstreams.fromFile(process.argv[2])
	.split(/\r?\n/)
	.each((line) => {
		if (!line) return;
		let data = JSON.parse(line);
		if (data.type !== targetType) return;
		processEntry(data, data.banned);
		numRecords++;
	})
	.intoPromise()
	.then(() => {
		return new Promise((resolve) => {
			mkdirp(outDir, function() {
				resolve();
			});
		});
	})
	.then(() => {
		let firstLine = true;
		zstreams.fromFile(process.argv[2])
			.split(/\r?\n/)
			.through(function(line) {
				if (firstLine) {
					this.push([ numRecords, numInputs, 1 ]);
					firstLine = false;
				}
				if (!line) return;
				let data = JSON.parse(line);
				if (data.type !== targetType) return;
				let results = processEntry(data);
				this.push(results[0]);
				this.push(results[1]);
			})
			.throughData((arr) => arr.join(' ') + '\n')
			.intoFile(outDataFile)
			.then(() => {
				console.warn('Writing bayesian classifiers ...');
				let bayesData = {};
				for (let classifierName in bayesClassifiers) {
					bayesData[classifierName] = bayesClassifiers[classifierName].toJson();
				}
				fs.writeFileSync(outBayesFile, JSON.stringify(bayesData, null, 2));
				console.warn('Done.');
			}).catch(pasync.abort);
	}).catch(pasync.abort);


function processEntry(entry, trainBayesClassifiers) {
	let inputs = buildInputs(entry.data, entry.type === 'comment', bayesClassifiers, trainBayesClassifiers);
	let outputs = entry.banned ? [ 1.0 ] : [ 0.0 ];
	return [ inputs, outputs ];
}


