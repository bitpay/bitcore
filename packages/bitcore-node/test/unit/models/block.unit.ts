import { expect } from 'chai';
import { BlockModel } from '../../../src/models/block';
import * as sinon from 'sinon';

describe('Block Model', function(){
    it('should have a test which runs', function(){
        expect(true).to.equal(true);
    });

    //TODO: addBlock

    describe('getLocalTip', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('should return with height zero if there are no blocks', async () => {
            sandbox.stub(BlockModel, 'findOne'). returns({
                sort: sandbox.stub().returnsThis(),
                exec: sandbox.stub().returns(null, null)
            });
            const params = { chain: 'BTC', network: 'regtest' };
            const result = await BlockModel.getLocalTip(params);
            expect(result).to.deep.equal({height: 0});
        });
    });

    describe('getPoolInfo', () => {
        it('UNIMPLEMENTED: should return pool info given a coinbase string', () => {
            expect(() => {
                const result = BlockModel.getPoolInfo('');
            }).to.not.throw(TypeError);
        });
    });

    describe('getLocatorHashes', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('it should return 65 zeros if there are no processed blocks for the chain and network', function(done) {
            sandbox.stub(BlockModel, 'find'). returns({
                sort: sandbox.stub().returnsThis(),
                limit: sandbox.stub().returnsThis(),
                exec: sandbox.stub().yields(null, [])
            });
            const params = { chain: 'BTC', network: 'regtest' };
            const result = BlockModel.getLocatorHashes(params, function(err, result) {
                expect(err).to.not.exist;
                expect(result).to.deep.equal([Array(65).join('0')]);
                done();
            });
        });
    });
    
    //TODO: handleReorg

    //TODO: _apiTransform

});