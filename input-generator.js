'use strict';


const getPath = require('objtools').getPath;
const isScalar = require('objtools').isScalar;
const bayes = require('bayes');

let numCommentsInputs, numPostsInputs;

// bayesClassifiers is an array of bayes objects
// trainBayesClassifiers is null to not do training, or one of the values "good"/false, "bad"/true
function buildInputs(data, isComment, bayesClassifiers, trainBayesClassifiers) {
	let inputs = [];
	if (trainBayesClassifiers === true) trainBayesClassifiers = 'bad';
	else if (trainBayesClassifiers === false) trainBayesClassifiers = 'good';
	function stringInput(field) {
		addStringFieldInputs(getPath(data, field), (isComment ? 'comment-' : 'post-') + field, inputs, bayesClassifiers, trainBayesClassifiers);
	}
	function dateInput(field) {
		addDateFieldInputs(getPath(data, field), (isComment ? 'comment-' : 'post-') + field, inputs);
	}
	stringInput('author');
	//stringInput('author_flair_text');
	//dateInput('created_utc');
	if (isComment) {
		stringInput('body');
	} else {
		stringInput('title');
	}
	if (isComment) {
		if (!numCommentsInputs) {
			numCommentsInputs = inputs.length;
		}
		if (numCommentsInputs !== inputs.length) throw new Error('Input length mismatch');
	} else {
		if (!numPostsInputs) {
			numPostsInputs = inputs.length;
		}
		if (numPostsInputs !== inputs.length) throw new Error('Input length mismatch');
	}
	return inputs;
}

function addCharacterClassInputs(str, inputs) {
	let upper = 0;
	let lower = 0;
	let letter = 0;
	let punc = 0;
	let whitespace = 0;
	let vowel = 0;
	let consonant = 0;
	let newline = 0;
	let number = 0;
	let printable = 0;

	let len = str.length;
	for (let i = 0; i < len; ++i) {
		let c = str[i];
		let isUpper = /[A-Z]/.test(c);
		let isLower = /[a-z]/.test(c);
		let isLetter = isUpper || isLower;
		let isNumber = /[0-9]/.test(c);
		let isWhitespace = /[ \t]/.test(c);
		let isVowel = /[aeiou]/.test(c);
		let isConsonant = /[qwrtpsdfghjklzxcvbnm]/.test(c);
		let isNewline = (c === '\n');
		let isPrintable = c.charCodeAt(0) > 32;
		let isPunc = isPrintable && !isLetter && !isNumber;
		if (isUpper) upper++;
		if (isLower) lower++;
		if (isLetter) letter++;
		if (isPunc) punc++;
		if (isWhitespace) whitespace++;
		if (isVowel) vowel++;
		if (isConsonant) consonant++;
		if (isNewline) newline++;
		if (isNumber) number++;
		if (isPrintable) printable++;
	}

	let counts = [ upper, lower, letter, punc, whitespace, vowel, consonant, newline, number, printable ];
	let fractions = counts.map((c) => len ? (c / len) : 0);
	Array.prototype.push.apply(inputs, counts);
	Array.prototype.push.apply(inputs, fractions);
}

function maxConsecutiveChars(str, reg) {
	let cur = 0;
	let lastC = str[0];
	let len = str.length;
	let max = 0;
	for (let i = 1; i < len; i++) {
		let c = str[i];
		if (c === lastC && reg.test(c)) {
			cur++;
		} else {
			if (cur > max) max = cur;
			cur = 0;
		}
		lastC = c;
	}
	return max;
}

function getStringStatsInputs(value) {
	let inputs = [];
	if (typeof value !== 'string') value = '';
	inputs.push(value.length);
	addCharacterClassInputs(value, inputs);
	inputs.push(maxConsecutiveChars(value, /./));
	inputs.push(maxConsecutiveChars(value, /[A-Za-z]/));
	inputs.push(maxConsecutiveChars(value, /[.?!-]/));
	inputs.push(maxConsecutiveChars(value, / \t/));
	return inputs;
}

function addWordsStats(str, inputs) {
	let words = str.split(/[^a-zA-Z0-9']/);
	inputs.push(words.length);
	if (!words) words = [ '' ];
	let stats = [];
	let wordLengths = [];
	for (let i = 0; i < 20; i++) wordLengths.push(0);
	for (let word of words) {
		if (word.length < 20) wordLengths[word.length]++;
		let wordStats = getStringStatsInputs(word);
		for (let i = 0; i < wordStats.length; i++) {
			if (!stats[i]) stats[i] = { min: Infinity, max: -Infinity, sum: 0 };
			if (wordStats[i] < stats[i].min) stats[i].min = wordStats[i];
			if (wordStats[i] > stats[i].max) stats[i].max = wordStats[i];
			stats[i].sum += wordStats[i];
		}
	}
	for (let s of stats) {
		s.avg = s.sum / words.length;
		inputs.push(s.min, s.max, s.avg);
	}
	Array.prototype.push.apply(inputs, wordLengths);
}

function ngramTokenizer(n) {
	return function(text) {
		let tokens = [];
		for (let i = n - 1; i < text.length; i++) {
			tokens.push(text.slice(i - n + 1, n));
		}
		return tokens;
	};
}

function nwordTokenizer(n) {
	return function(text) {
		let words = text.split(/[^A-Za-z'0-9-]/).map((s) => s.toLowerCase());
		let tokens = [];
		for (let i = n - 1; i < words.length; i++) {
			tokens.push(words.slice(i - n + 1, n).join(' '));
		}
		return tokens;
	}
}

const bayesTokenizers = [
	function(text) { return text.split(/[^A-Za-z'0-9-]/).map((s) => s.toLowerCase()); },
	function(text) { return text.split(''); },
	ngramTokenizer(2),
	ngramTokenizer(3),
	nwordTokenizer(2),
	nwordTokenizer(3)
];

function addBayesInputs(value, name, inputs, bayesClassifiers, trainBayesClassifiers) {
	for (let i = 0; i < bayesTokenizers.length; i++) {
		let tokenizer = bayesTokenizers[i];
		let classifierName = 'bayes-' + name + '-' + i;
		if (!bayesClassifiers[classifierName]) {
			bayesClassifiers[classifierName] = bayes({ tokenizer });
		}
		let classifier = bayesClassifiers[classifierName];

		let tokens = classifier.tokenizer(value);
		let frequencyTable = classifier.frequencyTable(tokens);
		let categories = [ 'good', 'bad' ];
		for (let category of categories) {
			if (!tokens.length || !classifier.categories[category]) {
				inputs.push(0, 0, 0);
				continue;
			}
			let categoryProb = classifier.totalDocuments ? (classifier.docCount[category] / classifier.totalDocuments) : 0;
			let logProb = categoryProb ? Math.log(categoryProb) : 0;
			let totalTokenProb = 0;
			let totalLogTokenProb = 0;
			let maxTokenProb = 0;
			for (let token of tokens) {
				let count = frequencyTable[token];
				let tokenProb = classifier.tokenProbability(token, category);
				if (tokenProb > maxTokenProb) maxTokenProb = tokenProb;
				let logTokenProb = tokenProb ? Math.log(tokenProb) : 0;
				totalTokenProb += count / tokens.length * tokenProb;
				totalLogTokenProb += count / tokens.length * logTokenProb;
			}
			inputs.push(totalTokenProb / tokens.length);
			inputs.push(totalTokenProb);
			//inputs.push(totalLogTokenProb / tokens.length);
			//inputs.push(totalLogTokenProb);
			inputs.push(maxTokenProb);
		}

		inputs.push(classifier.categorize(value) === 'good' ? 1.0 : 0.0);

		if (trainBayesClassifiers) {
			classifier.learn(value, trainBayesClassifiers);
		}
	}
}

function addStringFieldInputs(value, name, inputs, bayesClassifiers, trainBayesClassifiers) {
	if (typeof value !== 'string') value = '';
	Array.prototype.push.apply(inputs, getStringStatsInputs(value));
	addWordsStats(value, inputs);
	addBayesInputs(value, name, inputs, bayesClassifiers, trainBayesClassifiers);
}

function addDateFieldInputs(value, name, inputs) {
	let date = new Date(value * 1000);
	const addComponentInputs = (value, min, max) => {
		for (let i = min; i <= max; i++) {
			if (value === i) {
				inputs.push(1);
			} else {
				inputs.push(0);
			}
		}
	};
	//addComponentInputs(date.getDate(), 1, 31);
	addComponentInputs(date.getDay(), 0, 6);
	addComponentInputs(date.getHours(), 0, 23);
	addComponentInputs(date.getMinutes(), 0, 59);
	//addComponentInputs(date.getSeconds(), 0, 59);
}




module.exports = {
	buildInputs
};

