'use strict';


const fs = require('fs');
const zstreams = require('zstreams');
const pasync = require('pasync');
const getPath = require('objtools').getPath;
const isScalar = require('objtools').isScalar;

if (!process.argv[2]) throw new Error('Requires filename as argument');

let totalBanComments = 0;
let totalBanned = 0;
let totalPosts = 0;
let totalComments = 0;

// Find the time of the most recent banned post
let recentBannedPost = null;
let recencyThreshold;
zstreams.fromFile(process.argv[2])
	.split(/\r?\n/)
	.each((line) => {
		let data = JSON.parse(line);
		let post = getPath(data, '0.data.children.0');
		let comments = data[1];
		if (!post || post.kind !== 't3') return;
		let postBanned = containsBanComment(comments);
		if (postBanned && (!recentBannedPost || post.data.created_utc > recentBannedPost)) {
			recentBannedPost = post.data.created_utc;
		}
	})
	.intoPromise()
	.then(() => {
		recencyThreshold = recentBannedPost - 6 * 3600;
		// Process and output data
		zstreams.fromFile(process.argv[2])
			.split(/\r?\n/)
			.each((line) => {
				let data = JSON.parse(line);
				processPost(data);
			})
			.intoPromise()
			.then(() => {
				if (totalBanComments !== totalBanned) {
					console.warn(`Warning: Found ${totalBanComments} ban comments but ${totalBanned} banned things`);
				}
				console.warn('Done.');
				console.warn(`- ${totalPosts} posts`);
				console.warn(`- ${totalComments} comments`);
				console.warn(`- ${totalBanned} banned`);
			}).catch(pasync.abort);
	});


function isBanComment(comment) {
	if (comment.author_flair_css_class !== 'mod' || !comment.body) return false;
	let isBan = /you have been banned from .*MaoGame.* for 24 hours for breaking the rule/i.test(comment.body);
	return isBan;
}

function containsBanComment(comments) {
	if (comments.kind !== 'Listing') throw new Error('Expected listing');
	comments = getPath(comments, 'data.children');
	return (comments || []).some((comment) => {
		return comment.kind === 't1' && isBanComment(comment.data);
	});
}

function containsBanReply(comment) {
	let replies = getPath(comment, 'data.replies');
	if (replies) return containsBanComment(replies);
	return false;
}

function processComments(comments, flatComments) {
	comments = getPath(comments, 'data.children') || [];
	for (let comment of comments) {
		if (comment.kind !== 't1') continue;
		let banned = containsBanReply(comment);
		if (!isBanComment(comment.data)) {
			flatComments.push({ comment, banned });
			if (banned) totalBanned++;
		} else {
			totalBanComments++;
		}
		processComments(comment.data.replies || [], flatComments);
	}
}

function makeOneLevel(obj) {
	let other = {};
	for (let key in obj) {
		let keepField = false;
		if (isScalar(obj[key])) keepField = true;
		else if (Array.isArray(obj[key]) && isScalar(obj[key][0])) keepField = true;
		if (keepField) {
			other[key] = obj[key];
		}
	}
	return other;
}

function processPost(data) {
	let post = getPath(data, '0.data.children.0');
	let comments = data[1];
	if (!post || post.kind !== 't3') return;
	let postBanned = containsBanComment(comments);
	if (postBanned) totalBanned++;
	let outObj = {
		type: 'post',
		data: makeOneLevel(post.data),
		banned: postBanned
	};
	totalPosts++;
	if (post.data.created_utc < recencyThreshold && !post.data.edited) {
		console.log(JSON.stringify(outObj));
	}
	let flatComments = [];
	processComments(comments, flatComments);
	for (let fc of flatComments) {
		let outObj = {
			type: 'comment',
			data: makeOneLevel(fc.comment.data),
			banned: fc.banned
		};
		totalComments++;
		if (fc.comment.data.created_utc < recencyThreshold && !fc.comment.data.edited) {
			console.log(JSON.stringify(outObj));
		}
	}
}

