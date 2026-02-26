import {MainTitle} from '../assets/styles/titles';
import {Grid} from '../assets/styles/grid';
import styled from 'styled-components';
import {Tile, TileDescription} from '../assets/styles/tile';
import {getFormattedDate} from '../utilities/helper-methods';
import {motion} from 'framer-motion';
import {routerFadeIn} from '../utilities/animations';
import {useNavigate} from 'react-router-dom';
import React from 'react';
import {Black, LightBlack, NeutralSlate, Slate30} from '../assets/styles/colors';

const SearchTile = styled.div`
  margin: 0.5rem 0;
  background-color: ${({theme: {dark}}) => (dark ? LightBlack : NeutralSlate)};
  padding: 1rem;

  &:hover {
    cursor: pointer;
  }
`;

const SearchTileHeader = styled.div`
  display: flex;
  align-items: center;
  font-size: 18px;
`;
const HeaderImg = styled.div`
  margin-right: 0.5rem;
`;

const HeaderChip = styled.div`
  margin: 0 0.5rem;
  background-color: ${Slate30};
  border-radius: 25px;
  padding: 0.2rem 0.5rem;
  color: ${Black};
  text-transform: capitalize;
  font-size: 14px;
`;

interface Block {
  chain: string;
  network: string;
  hash: string;
  time: string;
  height: number;
}

interface Transaction {
  blockTime: string;
  chain: string;
  network: string;
  txid: string;
}

interface Address {
  chain: string;
  network: string;
  address: string;
}

const Search: React.FC = () => {
  const navigate = useNavigate();

  const matches = JSON.parse(sessionStorage.getItem('matches') || '');

  const goToTx = ({chain, network, txid}: {chain: string; network: string; txid: string}) => {
    navigate(`/${chain}/${network}/tx/${txid}`);
  };

  const goToAddress = ({chain, network, address}: Address) => {
    navigate(`/${chain}/${network}/address/${address}`);
  };

  const goToBlock = ({chain, network, hash}: {chain: string; network: string; hash: string}) => {
    navigate(`/${chain}/${network}/block/${hash}`);
  };

  return (
    <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
      {matches && (
        <>
          {matches.blocks && matches.blocks.length > 0 && (
            <>
              <MainTitle>Blocks</MainTitle>
              <Grid>
                {matches.blocks.map(
                  ({chain, network, hash, height, time}: Block, index: number) => {
                    return (
                      <SearchTile key={index} onClick={() => goToBlock({chain, network, hash})}>
                        <SearchTileHeader>
                          <HeaderImg>
                            <img
                              src={`https://bitpay.com/img/icon/currencies/${chain}.svg`}
                              width={35}
                              height={35}
                              alt='currency logo'
                            />
                          </HeaderImg>

                          <div>{chain}</div>

                          <HeaderChip>{network}</HeaderChip>

                          <div>#{height}</div>
                        </SearchTileHeader>

                        <Tile>
                          <TileDescription value>Block Hash {hash}</TileDescription>
                        </Tile>

                        <Tile padding='0'>
                          <TileDescription value>Mined on {getFormattedDate(time)}</TileDescription>
                        </Tile>
                      </SearchTile>
                    );
                  },
                )}
              </Grid>
            </>
          )}

          {matches.txs && matches.txs.length > 0 && (
            <>
              <MainTitle>Transactions</MainTitle>
              <Grid>
                {matches.txs.map(
                  ({chain, network, txid, blockTime}: Transaction, index: number) => {
                    return (
                      <SearchTile key={index} onClick={() => goToTx({chain, network, txid})}>
                        <SearchTileHeader>
                          <HeaderImg>
                            <img
                              src={`https://bitpay.com/img/icon/currencies/${chain}.svg`}
                              width={35}
                              height={35}
                              alt='currency logo'
                            />
                          </HeaderImg>

                          <div>{chain}</div>

                          <HeaderChip>{network}</HeaderChip>
                        </SearchTileHeader>
                        <Tile>
                          <TileDescription value>{txid}</TileDescription>
                        </Tile>

                        <Tile padding='0'>
                          <TileDescription value>
                            Received Time{getFormattedDate(blockTime)}
                          </TileDescription>
                        </Tile>
                      </SearchTile>
                    );
                  },
                )}
              </Grid>
            </>
          )}

          {matches.addresses && matches.addresses.length > 0 && (
            <>
              <MainTitle>Addresses</MainTitle>
              <Grid>
                {matches.addresses.map(({chain, network, address}: Address, index: number) => {
                  return (
                    <SearchTile key={index} onClick={() => goToAddress({chain, network, address})}>
                      <SearchTileHeader>
                        <HeaderImg>
                          <img
                            src={`https://bitpay.com/img/icon/currencies/${chain}.svg`}
                            width={35}
                            height={35}
                            alt='currency logo'
                          />
                        </HeaderImg>

                        <div>{chain}</div>

                        <HeaderChip>{network}</HeaderChip>
                      </SearchTileHeader>

                      <Tile>
                        <TileDescription value>{address}</TileDescription>
                      </Tile>
                    </SearchTile>
                  );
                })}
              </Grid>
            </>
          )}
        </>
      )}
    </motion.div>
  );
};

export default Search;
