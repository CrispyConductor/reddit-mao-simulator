'use strict';

const fanny = require('fanny');
const pasync = require('pasync');

if (!process.argv[2] || !process.argv[3]) throw new Error('Requires training data filename and result ANN filename');


let ann;
let trainData, testData;

fanny.loadTrainingData(process.argv[2]).then((allData) => {
	if (!process.argv[4]) {
		trainData = allData;
		testData = null;
	} else {
		allData.shuffle();
		let len = allData.getLength();
		let trainFraction = parseFloat(process.argv[4]);
		let trainCount = Math.floor(len * trainFraction);
		trainData = allData.clone()
		trainData.subset(0, trainCount);
		testData = allData.clone();
		testData.subset(trainCount, len - trainCount);
	}
	//ann = fanny.createANN({ type: 'shortcut', layers: [ allData.getNumInputs(), allData.getNumOutputs() ] });
	ann = fanny.createANN({ layers: [ allData.getNumInputs(), 400, allData.getNumOutputs() ] });
	ann.setOption('bitFailLimit', 0.25);
	console.log('Train data length: ' + trainData.getLength());
	if (testData) console.log('Test data length: ' + testData.getLength());
	//let maxBitFail = Math.floor(0.05 * trainData.getLength());
	//console.log('Max bitfail: ' + maxBitFail);
	return ann.train(trainData, {
		cascade: false,
		//cascade: true,
		stopFunction: 'MSE',
		//desiredError: maxBitFail,
		desiredError: 0.01,
		//maxNeurons: 5
		maxEpochs: 300
	}, 'default');
})
	.then(() => {
		if (testData) {
			return ann.testData(testData).then(() => {
				let results = {
					mse: ann.getMSE(),
					bitFail: ann.getBitFail(),
					bitFailFrac: ann.getBitFail() / testData.getLength()
				};
				console.log('Result Stats: ' + JSON.stringify(results));
			});
		}
	})
	.then(() => ann.save(process.argv[3]))
	.then(() => console.warn('Done.'))
	.catch(pasync.abort);

