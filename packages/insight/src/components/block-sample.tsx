import nProgress from 'nprogress';
import React, {FC, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {fetcher} from 'src/api/api';
import Info from 'src/components/info';
import {getApiRoot} from 'src/utilities/helper-methods';
import {BlocksType} from 'src/utilities/models';
import styled from 'styled-components';

const BlockChip = styled.div`
  border: 4px solid ${({theme: {dark}}) => dark ? '#333' : '#ddd'};
  border-radius: 10px;
  padding: 1rem;
  width: 12rem;
  max-width: 400px;
  background-color: transparent;
  cursor: pointer;
  text-align: center;
`;

const BlockSample: FC<{currency: string; network: string}> = ({currency, network}) => {
  const navigate = useNavigate();

  const [blocksList, setBlocksList] = useState<BlocksType[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    nProgress.start();
    Promise.all([fetcher(`${getApiRoot(currency)}/${currency}/${network}/block?limit=5`)])
      .then(([data]) => {
        setBlocksList(data);
      })
      .catch((e: any) => {
        setError(e.message || 'Something went wrong. Please try again later.');
      })
      .finally(() => {
        nProgress.done();
      });
  }, []);

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  if (error) return <Info type={'error'} message={error} />;
  if (!blocksList?.length) return null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {blocksList.map((block: BlocksType, index: number) => {
        const {height, hash, transactionCount, time, size} = block;
        const milisecondsWhenMined = Date.now() - new Date(time).getTime();
        const minutesWhenMined = Math.floor(milisecondsWhenMined / 60000);
        return (
          <React.Fragment key={index}>
            <BlockChip onClick={() => gotoSingleBlockDetailsView(hash)}>
              <b>
                <div>{height}</div>
                <div>{transactionCount} transactions</div>
                <div>{size} bytes</div>
                <div style={{whiteSpace: 'nowrap'}}>mined {minutesWhenMined} minutes ago</div>
              </b>
            </BlockChip>
            {index !== blocksList.length - 1 && (
              <div style={{fontSize: '1.5rem', color: '#666'}}>|</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default BlockSample;
