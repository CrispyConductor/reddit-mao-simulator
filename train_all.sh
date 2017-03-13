#!/bin/bash

mkdir -p data/comments
mkdir -p data/posts

if [ $# -lt 1 ]; then
	echo 'Must supply parsed corpus filename (and optional training data fraction)'
	exit 1
fi

echo "Making training data for comments ..."
node make-train-data.js "$1" "./data/comments" comments

echo "Making training data for posts ..."
node make-train-data.js "$1" "./data/posts" posts

echo "Training comments ..."
node train.js "./data/comments/data.train" "./data/comments/neural_net.ann" $2 | tee /tmp/mao_train_comments_out
cat /tmp/mao_train_comments_out | grep '^Result Stats:' | cut -d ':' -f 2- | cut -d ' ' -f 2- > ./data/comments/train_results.json

echo "Training posts ..."
node train.js "./data/posts/data.train" "./data/posts/neural_net.ann" $2 | tee /tmp/mao_train_posts_out
cat /tmp/mao_train_posts_out | grep '^Result Stats:' | cut -d ':' -f 2- | cut -d ' ' -f 2- > ./data/posts/train_results.json


