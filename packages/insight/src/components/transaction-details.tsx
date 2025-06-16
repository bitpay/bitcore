import {Transaction} from '../utilities/models';
import {
  aggregateItems,
  getAddress,
  getConvertedValue,
  getFormattedDate,
  hasUnconfirmedInputs,
  isRBF,
  getLib,
} from '../utilities/helper-methods';
import {useState, useEffect, FC, memo, ReactNode, Children} from 'react';
import {
  TransactionBodyCol,
  TransactionTile,
  TransactionTileBody,
  TransactionTileHeader,
  TxsPlusSign,
  TransactionChip,
  TransactionTileFlex,
  ArrowDiv,
  ScriptText,
  SpanLink,
} from '../assets/styles/transaction';
import {Tile, TileDescription} from '../assets/styles/tile';
import ArrowSvg from '../assets/images/arrow.svg';
import BlueArrowSvg from '../assets/images/arrow-blue.svg';
import CircleSvg from '../assets/images/circle.svg';
import {useNavigate, createSearchParams} from 'react-router-dom';
import styled, { useTheme } from 'styled-components';
import {Slate, SlateDark} from '../assets/styles/colors';

const TextElipsis = styled(ScriptText)`
  overflow: hidden;
  text-overflow: ellipsis;
  word-wrap: normal;
`;

const SelectedPill = styled.div`
  margin-top: 1rem;
  width: 100px;
  padding: 5px 10px;
  border: 1px solid ${({theme: {dark}}) => (dark ? SlateDark : Slate)};
  text-align: center;
  border-radius: 50px;
  color: ${({theme: {dark}}) => (dark ? Slate : SlateDark)};
  font-weight: 500;
  font-size: 16px;
`;

const TxAddressLink = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  width: 100%;
  margin-right: 7px;
  &:hover {
    cursor: pointer;
  }
`

const BorderBoxLabel: FC<{children: ReactNode, label: string}> = ({children, label}) => {
  const theme = useTheme();
  const modifiedChildren = typeof children === 'object' 
    ? Children.map(children as JSX.Element, (child: JSX.Element) => {
        return <span {...child.props} style={{margin: 0}}></span>;
      })
    : children;
  
  return (
    <fieldset style={{
      border: `1.5px solid ${theme.dark ? '#5f5f5f' : '#ccc'}`,
      borderRadius: '5px',
      padding: '0.1rem 0.4rem',
      wordBreak: 'break-all',
      whiteSpace: 'normal',
      width: 'fit-content',
      height: 'fit-content'
    }}>
      <legend style={{margin: '-0.2rem 0.1rem'}}>{label}</legend>
      {modifiedChildren}
    </fieldset>
  );
}

interface TransactionDetailsProps {
  transaction: Transaction;
  currency: string;
  network: string;
  refTxid?: string;
  refVout?: number;
}
const TransactionDetails: FC<TransactionDetailsProps> = ({
  transaction,
  currency,
  network,
  refTxid,
  refVout,
}) => {
  const navigate = useNavigate();
  const [formattedInputs, setFormattedInputs] = useState<any[]>();
  const [lib, setLib] = useState<any>(getLib(currency));
  const {outputs, txid, blockTime, blockHeight, coinbase, inputs, confirmations, fee, value} =
    transaction;
  const goToAddress = (address: any) => {
    return navigate(`/${currency}/${network}/address/${address}`);
  };

  const createOptionalSearchParams = (refTxid?: string, refVout?: number) => {
    if (refTxid == null && refVout == null) {
      return undefined;
    }
    return `?${createSearchParams({
      refTxid: refTxid != undefined ? refTxid.toString() : '',
      refVout: refVout != undefined ? refVout.toString() : '',
    })}`;
  };

  const goToTx = (tx: any, refTxid?: string, refVout?: number) => {
    return navigate({
      pathname: `/${currency}/${network}/tx/${tx}`,
      search: createOptionalSearchParams(refTxid, refVout),
    });
  };

  const isInputSelected = (input: any) => {
    // If refTxid doesn't exist then it's selecting an output (thus false)
    // OR if refVout doesn't exist then false
    if (refTxid == null || refTxid == '' || refVout == null) {
      return false;
    }
    return input.mintTxid === refTxid && input.mintIndex === refVout;
  };

  const isOutputSelected = (outputIndex: number) => {
    // If refTxid exists then it's selecting an input (thus false)
    // OR if refVout doesn't exist then false
    if ((refTxid != null && refTxid != '') || refVout == null) {
      return false;
    }
    return outputIndex == refVout;
  };

  const isOpReturn = (vout: any) => {
    const s = new lib.Script(vout.script);
    return s.toASM().includes('OP_RETURN');
  };

  const getOpReturnText = (vout: any) => {
    const s = new lib.Script(vout.script);
    const hex = s.toASM().split('OP_RETURN')[1]?.trim();
    return Buffer.from(hex, 'hex').toString('utf8');
  };

  const outputsLength = outputs.length;

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!inputs) {
      return;
    }
    setFormattedInputs(aggregateItems(inputs));
  }, [inputs]);

  useEffect(() => {
    setLib(getLib(currency));
  }, [currency]);

  return (
    <TransactionTile key={txid}>
      <TransactionTileHeader>
        <TileDescription value padding='0 .25rem 0 0'>
          <TxsPlusSign onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? '-' : '+'}
          </TxsPlusSign>
          <SpanLink onClick={() => goToTx(txid)}>{txid}</SpanLink>
        </TileDescription>

        <TileDescription textAlign='right' value padding='0 0 0 0.25rem'>
          {`${blockHeight > -1 ? 'Mined' : 'Seen'} on: ${getFormattedDate(blockTime)}`}
        </TileDescription>
      </TransactionTileHeader>

      <TransactionTileBody>
        <TransactionBodyCol type='Five' padding='0 1rem'>
          {coinbase && <Tile>No Inputs (Newly Generated Coins)</Tile>}

          {!coinbase && (
            <>
              {formattedInputs?.map((vi: any, i: number, arr: any[]) => {
                return (
                  <div key={i}>
                    {vi.items.map((item: any, itemIndex: number) => (
                      <div key={item.mintTxid + itemIndex}>
                        {isInputSelected(item) ? <SelectedPill>Selected</SelectedPill> : null}
                        <div style={{
                          display: 'flex',
                          marginTop: '1rem', 
                          ...(showDetails && {borderBottom: '2px solid', paddingBottom: '0.25rem'})
                        }}>
                          <ArrowDiv margin='auto .5rem auto 0'>
                            <img
                              src={BlueArrowSvg}
                              width={17}
                              height={17}
                              alt='arrow'
                              onClick={() => goToTx(item.mintTxid, undefined, item.mintIndex)}
                            />
                          </ArrowDiv>
                          {getAddress(vi) !== 'Unparsed address' ? (
                            <TxAddressLink onClick={() => goToAddress(getAddress(vi))} style={{wordBreak: showDetails ? 'break-all' : 'unset'}}>
                              {getAddress(vi)}
                            </TxAddressLink>
                          ) : (
                            <span style={{textAlign: 'left', width: '100%'}}>
                              Unparsed address
                            </span>
                          )}
                          <div style={{minInlineSize: 'fit-content'}}>
                            {getConvertedValue(item.value, currency)} {currency}
                          </div>
                        </div>

                        <Tile invertedBorderColor={arr.length > 1 && arr.length !== i + 1} padding={showDetails ? undefined : '0.4rem'}>
                          {showDetails &&
                            <>

                              <TileDescription padding='0 1rem 0 0' value>
                                <BorderBoxLabel label='Tx ID'>
                                  <TextElipsis>
                                    <SpanLink
                                      onClick={() =>
                                        goToTx(item.mintTxid, undefined, item.mintIndex)
                                      }>
                                      {item.mintTxid}
                                    </SpanLink>
                                  </TextElipsis>
                                </BorderBoxLabel>
                                  
                                <span style={{display: 'flex'}}>
                                  <BorderBoxLabel label='Tx Index'>
                                    <TextElipsis>
                                      {item.mintIndex}
                                    </TextElipsis>
                                  </BorderBoxLabel>

                                  {item.uiConfirmations && confirmations > 0 ? (
                                    <BorderBoxLabel label='Confirmations'>
                                      <ScriptText>
                                        {item.uiConfirmations + confirmations}
                                      </ScriptText>
                                    </BorderBoxLabel>
                                  ) : null}
                                </span>

                                {item.script && (
                                  <>
                                    <BorderBoxLabel label='Script Hex'>{item.script}</BorderBoxLabel>
                                    <BorderBoxLabel label='Script ASM'>{new lib.Script(item.script).toASM()}</BorderBoxLabel>
                                  </>
                                )}
                              </TileDescription>
                            </>
                          }
                        </Tile>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </TransactionBodyCol>

        <TransactionBodyCol type='One' backgroundColor='transparent' textAlign='center'>
          <img src={ArrowSvg} width={15} height={15} alt='arrow' />
        </TransactionBodyCol>

        <TransactionBodyCol type='Six' textAlign='right' padding='0 1rem'>
          {outputs.map((vo: any, i: number) => {
            return (
              <div key={i}>
                {isOutputSelected(i) ? <SelectedPill>Selected</SelectedPill> : null}
                <div style={{
                  display: 'flex',
                  marginTop: '1rem', 
                  ...(showDetails && {borderBottom: '2px solid', paddingBottom: '0.25rem'})
                }}>
                  {getAddress(vo) !== 'Unparsed address' ? (
                    <TxAddressLink onClick={() => goToAddress(getAddress(vo))} style={{wordBreak: showDetails ? 'break-all' : 'unset'}}>
                      {getAddress(vo)}
                    </TxAddressLink>
                  ) : (
                    <span style={{textAlign: 'left', width: '100%'}}>
                      {isOpReturn(vo) ? 'OP_RETURN' : 'Unparsed address'}
                    </span>
                  )}
                  <div style={{minInlineSize: 'fit-content', display: 'flex'}}>
                    {getConvertedValue(vo.value, currency)} {currency}{' '}
                    <ArrowDiv margin='auto 0 auto .5rem'>
                      <img
                        src={vo.spentTxid ? BlueArrowSvg : (isOpReturn(vo) ? CircleSvg : ArrowSvg)}
                        width={17}
                        height={17}
                        alt='Spent'
                        title={vo.spentTxid ? 'Spent' : (isOpReturn(vo) ? 'Unspendable' : 'Unspent')}
                        style={{margin: `0px ${isOpReturn(vo) ? '4px' : '5px'}`}}
                        onClick={() => vo.spentTxid && goToTx(vo.spentTxid, transaction.txid, i)}
                      />
                    </ArrowDiv>
                  </div>
                </div>
                <Tile invertedBorderColor={outputsLength > 1 && outputsLength !== i + 1} padding={showDetails ? undefined : '0.4rem'}>
                  {showDetails &&
                    <>
                      <TileDescription padding='0 1rem 0 0' value>
                        {vo.spentTxid && (
                          <BorderBoxLabel label='Spent By'>
                            <TextElipsis>
                              <SpanLink onClick={() => goToTx(vo.spentTxid, transaction.txid, i)}>
                                {vo.spentTxid}
                              </SpanLink>
                            </TextElipsis>
                          </BorderBoxLabel>
                        )}
                        {isOpReturn(vo) && <ScriptText>{getOpReturnText(vo)}</ScriptText>}
                        {vo.script && (
                          <>
                            <BorderBoxLabel label='Script Hex'>{new lib.Script(vo.script).toHex()}</BorderBoxLabel>
                            <BorderBoxLabel label='Script ASM'>{new lib.Script(vo.script).toASM()}</BorderBoxLabel>
                          </>
                        )}
                      </TileDescription>
                    </>
                  }
                </Tile>
              </div>
            );
          })}
        </TransactionBodyCol>
      </TransactionTileBody>

      <TransactionTileFlex>
        <div>
          {!coinbase && fee > 0 && (
            <TransactionChip>
              FEE: {getConvertedValue(fee, currency)} {currency}
            </TransactionChip>
          )}
        </div>

        <TransactionTileFlex>
          {confirmations === -5 && <TransactionChip error>Expired</TransactionChip>}

          {confirmations === -3 && <TransactionChip error>Invalid</TransactionChip>}

          {confirmations === -1 && <TransactionChip warning>Unconfirmed</TransactionChip>}

          {confirmations === 1 && <TransactionChip primary>1 Confirmation</TransactionChip>}

          {confirmations > 1 && (
            <TransactionChip primary>{confirmations} Confirmations</TransactionChip>
          )}

          {isRBF(inputs) && confirmations === -1 && (
            <TransactionChip error>Replace By Fee (RBF) enabled</TransactionChip>
          )}

          {hasUnconfirmedInputs(inputs) && (
            <TransactionChip error>Tx has unconfirmed inputs</TransactionChip>
          )}

          <TransactionChip margin='0 0 0 1rem'>
            {getConvertedValue(value, currency)} {currency}
          </TransactionChip>
        </TransactionTileFlex>
      </TransactionTileFlex>
    </TransactionTile>
  );
};

export default memo(TransactionDetails);
