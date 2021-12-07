/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because
 *  and array isn't a persisten storage method.
 *
 */

 const SHA256 = require('crypto-js/sha256');
 const BlockClass = require('./block.js');
 const bitcoinMessage = require('bitcoinjs-message');
 const log = require('debug')('blockchain');

class Blockchain {
  /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will
     * create it. You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
  async initializeChain() {
    if (this.height === -1) {
      const block = new BlockClass.Block({ data: 'Genesis Block' });
      await this.#addBlock(block);
    }
  }

  /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
  getChainHeight() {
    return new Promise((resolve) => {
      resolve(this.height);
    });
  }

  /**
     * #addBlock(block) will store a block in the chain
     * @param {*} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `#` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
  #addBlock(block) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      try {
        block.height = self.height + 1;
        block.time = new Date().getTime().toString().slice(0, -3);
        if (self.chain.length > 0) {
          block.previousBlockHash = self.chain[self.height].hash;
        }
        block.hash = SHA256(JSON.stringify(block)).toString();
        // add block to chain and increment height
        
        const copy = [...self.chain, block];

        resolve(
          this.#validateChainWithParam(copy).then((errors) => {
            if (errors.length == 0) {
              log(`added block ${block.hash}`);
              self.chain.push(block);
              self.height += 1;                      
              return block;
            } else {
              reject("invalid block");
            }          
          })
        );
      } catch (ex) {
        console.error(ex);
        reject(new Error('Error while adding block!'));
      }
    });
  }

  /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
  requestMessageOwnershipVerification(address) {
    // <WALLET_ADRESS>:${new Date().getTime().toString().slice(0,-3)}:starRegistry
    return new Promise((resolve) => {
      let time = new Date().getTime().toString().slice(0,-3);
      resolve(`${address}:${time}:starRegistry`);
    });
  }

  /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example:
     *   `parseInt(message.split(':')[1])`
     * 2. Get the current time:
     *   `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature:
     *    `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
  submitStar(address, message, signature, star) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      const messageTimeS = Number(message.split(':')[1]);
      const currentTimeS = Number(new Date().getTime().toString().slice(0, -3));
      const elapsed = currentTimeS - messageTimeS;
      if (elapsed < 300) {
        const verified = bitcoinMessage.verify(message, address, signature);
        if (verified) {
          const starObj = JSON.parse(star);
          const block = new BlockClass.Block({ data: starObj });
          block.addressHash = SHA256(address).toString();                                
          resolve(
            self.#addBlock(block)
          );
        } else {
          reject(
            new Error('message could not be verified')
          );
        }
      } else {
        reject(new Error(`too much time elapsed: ${elapsed}s`));
      }
    });
  }

  /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
  getBlockByHash(hash) {
    const self = this;
    return new Promise((resolve) => {
      const block = self.chain.find((element) => element.hash === hash);
      if (block) {
        resolve(block);
      } else {
        resolve(null);
      }
    });
  }

  /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     */
  getBlockByHeight(height) {
    const self = this;
    return new Promise((resolve) => {
      const block = self.chain.find((p) => p.height === height);
      resolve(block);
    });
  }

  /**
     * This method will return a Promise that will resolve with an array of Stars objects existing
     * in the chain and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
  getStarsByWalletAddress(address) {
    const self = this;
    const addressHash = SHA256(address).toString();
    return new Promise((resolve) => {
      const promiseOfStars = self.chain
        .filter((block) => block.addressHash === addressHash)
        .map((block) => 
          block.getBData().then(body => {
            return body.data;
          })        
        );
      resolve(Promise.all(promiseOfStars));
    });
  }


  #validatePredecessor(current, pred) {
    return new Promise((resolve, reject) => {
      if (current.previousBlockHash === pred.hash) {
        resolve();
      } else {
        reject(`expected ${pred.hash} for predecessor of block with `
          + `hash ${block.hash}, but was ${block.previousBlockHash}`);
      }
    })
  }

  #validateBlock(block) {
    return block.validate().then((valid) => {
      if (valid) {
        Promise.resolve();        
      } else {
        Promise.reject(`block with hash ${block.hash} is not valid`);
      }
    });
  }


  #validateChainWithParam(chain) {
    const errorLog = [];
    return new Promise((resolve) => {      
      chain.forEach((block, idx) => {
        
        errorLog.push(
          this.#validateBlock(block)
        );
        
        if (idx > 0) {
          errorLog.push(
            this.#validatePredecessor(block, chain[idx-1])
          );
        }

        resolve(
          Promise.all(errorLog)
            .then(() => {
              return [];
            }).catch((errors) => {
              return errors;
            })
        );
      });
    });
  }

   /**
     * This method will return a Promise that will resolve with the list of errors when validating
     * the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
      return this.#validateChainWithParam(this.chain);
    }

}

module.exports.Blockchain = Blockchain;
