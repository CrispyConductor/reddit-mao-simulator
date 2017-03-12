#!/bin/bash

mkdir -p data

SUFFIX="`date +%Y%m%d_%H%M`"
RAWFILENAME="data/raw-${SUFFIX}.txt"
node fetch.js > "$RAWFILENAME"
PARSEDFILENAME="data/corpus-${SUFFIX}.txt"
node parse.js "$RAWFILENAME" > ${PARSEDFILENAME}

