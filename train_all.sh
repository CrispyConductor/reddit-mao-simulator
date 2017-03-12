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

echo "Training posts ..."
node train.js "./data/posts/data.train" "./data/posts/neural_net.ann" $2 | tee /tmp/mao_train_posts_out

