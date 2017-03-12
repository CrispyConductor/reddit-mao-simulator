'use strict';

const request = require('request-promise');
const pasync = require('pasync');


function scanSubreddit(max) {
	let hasMore = true;
	const count = 25;
	let next = null;
	let total = 0;
	return pasync.whilst(() => hasMore && total < max, () => {
		let url = `https://www.reddit.com/r/MaoGame/.json?count=${count}`;
		if (next) url += `&after=${next}`;
		return Promise.resolve().then(() => request(url)).then((json) => {
			var response = JSON.parse(json);
			if (
				response.kind !== 'Listing' ||
				!response.data ||
				!response.data.children ||
				!response.data.children.length
			) {
				console.warn('Ending with response:', json);
				hasMore = false;
				return;
			}
			return pasync.eachSeries(response.data.children, (child) => {
				if (child.data && child.data.name) next = child.data.name;
				total++;
				if (child.kind !== 't3') return;
				console.warn('Got post: ' + child.data.title);
				return scanComments(child.data);
			});
		});
	});
}

function scanComments(post) {
	let url = `https://www.reddit.com/r/MaoGame/comments/${post.id}/.json`;
	return Promise.resolve().then(() => request(url))
		.then((json) => {
			let response = JSON.parse(json);
			console.log(JSON.stringify(response));
		});
}


scanSubreddit(250000000)
	.then(() => console.warn('Done.')).catch(pasync.abort);

