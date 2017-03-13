This project aims to help decipher the rules of Reddit's /r/MaoGame using machine learning techniques
by attempting to approximate the unknown rules of Mao.  It is a work in progress.

To crawl and parse /r/MaoGame to generate the corpus: `./download_dataset.sh` .  This will create a file named `corpus_DATE` in the `data` directory.

To train the neural net using 90% of the training set and test it with the other 10%: `./train_all.sh /path/to/corupus.txt 0.9`

To run the Mao game simulator server: `node serve.js`

