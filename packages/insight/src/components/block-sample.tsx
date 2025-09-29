import React, {FC} from 'react';
import {useNavigate} from 'react-router-dom';
import { getFormattedDate } from 'src/utilities/helper-methods';
import {BlocksType} from 'src/utilities/models';
import BlockGroupDarkSvg from '../assets/images/block-group-dark.svg';
import BlockGroupLightSvg from '../assets/images/block-group-light.svg';
import styled, { useTheme } from 'styled-components';
import { colorCodes } from 'src/utilities/constants';

const BlockChip = styled.div`
  border: 4px solid ${({theme: {dark}}) => (dark ? '#333' : '#ddd')};
  border-radius: 10px;
  padding: 1rem;
  background-color: transparent;
  cursor: pointer;
  text-align: center;
`;

const BlocksLinkChip = styled.div`
  display: flex;
  border-radius: 15px;
  font: menu;
  width: 150px;
  gap: 0.5rem;
  padding: 0.75rem 0;
  justify-content: center;
  cursor: pointer;
`

export type BlockAndFeeType = BlocksType & {
  feeData: {
    feeTotal: number;
    mean: number;
    median: number;
    mode: number;
  }
};

const BlockSample: FC<{currency: string; network: string, blocksList: BlockAndFeeType[]}> = ({currency, network, blocksList}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  const BlockGroupIcon: React.FC = () => {
    return (
      <img src={theme.dark ? BlockGroupLightSvg : BlockGroupDarkSvg}
        style={{height:'1.5rem'}}/>
    );
  }

  if (!blocksList?.length) return null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {blocksList.map((block: BlockAndFeeType, index: number) => {
        const { height, hash, transactionCount, time, size } = block;
        const median = block.feeData.median;
        return (
          <React.Fragment key={index}>
            <div style={{display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center', width: '100%'}}>
              <BlocksLinkChip style={{backgroundColor: colorCodes[currency]}} onClick={() => gotoSingleBlockDetailsView(hash)}>
                <BlockGroupIcon />
                <b>{height}</b>
                <BlockGroupIcon />
              </BlocksLinkChip>
 
                <BlockChip style={{flex: 1, width: '100%'}}>
                  <b style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: '100%',
                    gap: '2rem'
                  }}>
                    <span>{getFormattedDate(time)}</span>
                    <span>{transactionCount} transactions</span>
                    <span>{size / 1000} kB</span>
                    <span>~{median?.toFixed(4)} sats/Byte</span>
                  </b>
                </BlockChip>
            </div>
            {index !== blocksList.length - 1 && (
              <div style={{display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'flex-start'}}>
                <div
                  style={{
                    width: '4px',
                    height: '32px',
                    borderRadius: '1px',
                    background: colorCodes[currency],
                    marginLeft: '75px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </div>
            )}

          </React.Fragment>
        );
      })}
    </div>
  );
};

export default BlockSample;
