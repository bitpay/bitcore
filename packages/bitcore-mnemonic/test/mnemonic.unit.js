'use strict';

const should = require('chai').should();
const unorm = require('unorm');
const Mnemonic = require('..');
const errors = require('bitcore-lib').errors;
const bip39_vectors = require('./data/bip39-vectors.json');

describe('Mnemonic', function() {
  this.timeout(30000);

  describe('Constructor', function() {
    it('does not require new keyword', function() {
      const mnemonic = Mnemonic(); // jshint ignore:line
      mnemonic.should.be.instanceof(Mnemonic);
    });

    it('should fail with invalid data', function() {
      (function() {
        return new Mnemonic({});
      }).should.throw(errors.InvalidArgument);
    });

    it('should fail with unknown word list', function() {
      (function() {
        return new Mnemonic('pilots foster august tomorrow kit daughter unknown awesome model town village master');
      }).should.throw(errors.Mnemonic.UnknownWordlist);
    });

    it('should fail with invalid mnemonic', function() {
      (function() {
        return new Mnemonic('monster foster august tomorrow kit daughter unknown awesome model town village pilot');
      }).should.throw(errors.Mnemonic.InvalidMnemonic);
    });

    it('should fail with invalid ENT', function() {
      (function() {
        return new Mnemonic(64);
      }).should.throw(errors.InvalidArgument);
    });

    it('constructor should fail with invalid seed', function() {
      (function() {
        return new Mnemonic(Buffer.alloc(1));
      }).should.throw(errors.InvalidEntropy);
    });

    it('constructor defaults to english worldlist', function() {
      var mnemonic = new Mnemonic();
      mnemonic.wordlist.should.equal(Mnemonic.Words.ENGLISH);
    });

    it('allow using different worldlists', function() {
      var mnemonic = new Mnemonic(Mnemonic.Words.SPANISH);
      mnemonic.wordlist.should.equal(Mnemonic.Words.SPANISH);
    });

    it('constructor honor both length and wordlist', function() {
      var mnemonic = new Mnemonic(32 * 7, Mnemonic.Words.SPANISH);
      mnemonic.phrase.split(' ').length.should.equal(21);
      mnemonic.wordlist.should.equal(Mnemonic.Words.SPANISH);
    });

    it('constructor should detect standard wordlist', function() {
      var mnemonic = new Mnemonic('afirmar diseño hielo fideo etapa ogro cambio fideo toalla pomelo número buscar');
      mnemonic.wordlist.should.equal(Mnemonic.Words.SPANISH);
    });

  });

  it('chinese wordlist is complete', function() {
    Mnemonic.Words.CHINESE.length.should.equal(2048);
    Mnemonic.Words.CHINESE[0].should.equal('的');
    Mnemonic.Words.CHINESE.should.equal(Mnemonic.Words.CHINESE_SIMPLIFIED);
  });

  it('chinese (simplified) wordlist is complete', function() {
    Mnemonic.Words.CHINESE_SIMPLIFIED.length.should.equal(2048);
    Mnemonic.Words.CHINESE_SIMPLIFIED[0].should.equal('的');
    Mnemonic.Words.CHINESE_SIMPLIFIED[14].should.equal('个');
  });

  it('chinese (traditional) wordlist is complete', function() {
    Mnemonic.Words.CHINESE_TRADITIONAL.length.should.equal(2048);
    Mnemonic.Words.CHINESE_TRADITIONAL[0].should.equal('的');
    Mnemonic.Words.CHINESE_TRADITIONAL[14].should.equal('個');
  });

  it('czech wordlist is complete', function() {
    Mnemonic.Words.CZECH.length.should.equal(2048);
    Mnemonic.Words.CZECH[0].should.equal('abdikace');
  });

  it('english wordlist is complete', function() {
    Mnemonic.Words.ENGLISH.length.should.equal(2048);
    Mnemonic.Words.ENGLISH[0].should.equal('abandon');
  });

  it('french wordlist is complete', function() {
    Mnemonic.Words.FRENCH.length.should.equal(2048);
    Mnemonic.Words.FRENCH[0].should.equal('abaisser');
  });

  it('italian wordlist is complete', function() {
    Mnemonic.Words.ITALIAN.length.should.equal(2048);
    Mnemonic.Words.ITALIAN[0].should.equal('abaco');
  });

  it('japanese wordlist is complete', function() {
    Mnemonic.Words.JAPANESE.length.should.equal(2048);
    Mnemonic.Words.JAPANESE[0].should.equal('あいこくしん');
  });
  
  it('korean wordlist is complete', function() {
    Mnemonic.Words.KOREAN.length.should.equal(2048);
    Mnemonic.Words.KOREAN[0].should.equal('가격');
  });

  it('portuguese wordlist is complete', function() {
    Mnemonic.Words.PORTUGUESE.length.should.equal(2048);
    Mnemonic.Words.PORTUGUESE[0].should.equal('abacate');
  });

  it('russian wordlist is complete', function() {
    Mnemonic.Words.RUSSIAN.length.should.equal(2048);
    Mnemonic.Words.RUSSIAN[0].should.equal('абзац');
  });

  it('spanish wordlist is complete', function() {
    Mnemonic.Words.SPANISH.length.should.equal(2048);
    Mnemonic.Words.SPANISH[0].should.equal('ábaco');
  });

  it('turkish wordlist is complete', function() {
    Mnemonic.Words.TURKISH.length.should.equal(2048);
    Mnemonic.Words.TURKISH[0].should.equal('abajur');
  });

  it('allows use different phrase lengths', function() {
    var mnemonic;

    mnemonic = new Mnemonic(32 * 4);
    mnemonic.phrase.split(' ').length.should.equal(12);

    mnemonic = new Mnemonic(32 * 5);
    mnemonic.phrase.split(' ').length.should.equal(15);

    mnemonic = new Mnemonic(32 * 6);
    mnemonic.phrase.split(' ').length.should.equal(18);

    mnemonic = new Mnemonic(32 * 7);
    mnemonic.phrase.split(' ').length.should.equal(21);

    mnemonic = new Mnemonic(32 * 8);
    mnemonic.phrase.split(' ').length.should.equal(24);
  });

  it('validates a phrase', function() {
    var valid = Mnemonic.isValid('afirmar diseño hielo fideo etapa ogro cambio fideo toalla pomelo número buscar');
    valid.should.equal(true);

    var invalid = Mnemonic.isValid('afirmar diseño hielo fideo etapa ogro cambio fideo hielo pomelo número buscar');
    invalid.should.equal(false);

    var invalid2 = Mnemonic.isValid('afirmar diseño hielo fideo etapa ogro cambio fideo hielo pomelo número oneInvalidWord');
    invalid2.should.equal(false);

    var invalid3 = Mnemonic.isValid('totally invalid phrase');
    invalid3.should.equal(false);

    var valid2 = Mnemonic.isValid('caution opprimer époque belote devenir ficeler filleul caneton apologie nectar frapper fouiller');
    valid2.should.equal(true);
  });

  it('has a toString method', function() {
    var mnemonic = new Mnemonic();
    mnemonic.toString().should.equal(mnemonic.phrase);
  });

  it('has an inspect method', function() {
    var mnemonic = new Mnemonic();
    mnemonic.inspect().should.have.string('<Mnemonic:');
  });

  it('derives a seed without a passphrase', function() {
    var mnemonic = new Mnemonic();
    var seed = mnemonic.toSeed();
    should.exist(seed);
  });

  it('derives a seed using a passphrase', function() {
    var mnemonic = new Mnemonic();
    var seed = mnemonic.toSeed('my passphrase');
    should.exist(seed);
  });

  it('derives an extended private key', function() {
    var mnemonic = new Mnemonic();
    var pk = mnemonic.toHDPrivateKey();
    should.exist(pk);
  });

  it('derives an extended private key for keyType ed25519', function() {
    const phrase = 'crush desk brain index action subject tackle idea trim unveil lawn live';
    const mnemonic = new Mnemonic(phrase);
    const pk = mnemonic.toHDPrivateKey('', 'livenet', 'ed25519');
    should.exist(pk);
    pk.toString().should.equal('xprv9s21ZrQH143K3aKdQ6kXF1vj7R6LtkoLCiUXfM5bdbGXmhQkC1iXdnFfrxAAtaTunPUCCLwUQ3cpNixGLMbLAH1gzeCr8VZDe4gPgmKLb2X');
  });

  it('deriving an extended private key should fail for invalid seed', function() {
    (function() {
      var mnemonic = new Mnemonic();
      return mnemonic.toHDPrivateKey('', 'livenet', 'bad seed');
    }).should.throw('Invalid Key Type: bad seed');
  });

  it('Mnemonic.fromSeed should fail with invalid wordlist', function() {
    (function() {
      return Mnemonic.fromSeed(Buffer.alloc(1));
    }).should.throw(errors.InvalidArgument);
  });

  it('Mnemonic.fromSeed should fail with invalid seed', function() {
    (function() {
      return Mnemonic.fromSeed();
    }).should.throw(errors.InvalidArgument);
  });

  it('should fail with invalid entropy', function() {
    (function() {
      return Mnemonic.fromSeed(Buffer.alloc(512), Mnemonic.Words.ENGLISH);
    }).should.throw(errors.InvalidArgument);
  });


  // To add new vectors for different languages:
  // 1. Add and implement the wordlist so it appears in Mnemonic.Words
  // 2. Add the vectors and make sure the key is lowercase of the key for Mnemonic.Words
  function getWords(language) {
    return Mnemonic.Words[language.toUpperCase()];
  }

  for (const language in bip39_vectors) {
    if (bip39_vectors.hasOwnProperty(language)) {
      for (let i = 0; i < bip39_vectors[language].length; i++) {
        it(`should pass test vector for ${language} #${i}`, function() {
          const wordlist = getWords(language);
          const vector = bip39_vectors[language][i];
          const [
            code,
            _mnemonic,
            seed,
            xpriv
          ] = vector;
          const passphrase = 'TREZOR';
          const mnemonic = unorm.nfkd(_mnemonic); // Normalization Form Compatibility Decomposition (NKFD)
          const mnemonic1 = Mnemonic.fromSeed(Buffer.from(code, 'hex'), wordlist).phrase;
          mnemonic1.should.equal(mnemonic);
  
          const m = new Mnemonic(_mnemonic);
          m.toString().should.equal(mnemonic); // should be normalized
          m.toSeed(passphrase).toString('hex').should.equal(seed);
  
          Mnemonic.isValid(mnemonic, wordlist).should.equal(true);
          m.toHDPrivateKey(passphrase).toString().should.equal(xpriv);
        });
      }
    }
  }

});
