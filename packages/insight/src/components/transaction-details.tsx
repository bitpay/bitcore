import {Transaction} from '../utilities/models';
import {
  aggregateItems,
  getAddress,
  getConvertedValue,
  getFormattedDate,
  hasUnconfirmedInputs,
  isRBF,
  getLib
} from '../utilities/helper-methods';
import {useState, useEffect, FC, memo} from 'react';
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
import {useNavigate, createSearchParams} from 'react-router-dom';
import styled from 'styled-components';
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

                        <Tile invertedBorderColor={arr.length > 1 && arr.length !== i + 1}>
                          {showDetails && (
                            <ArrowDiv margin='auto .5rem auto 0'>
                              <img
                                src={ArrowSvg}
                                width={17}
                                height={17}
                                alt='arrow'
                                onClick={() => goToTx(item.mintTxid, undefined, item.mintIndex)}
                              />
                            </ArrowDiv>
                          )}

                          <TileDescription padding='0 1rem 0 0' value>
                            {getAddress(vi) !== 'Unparsed address' ? (
                              <SpanLink onClick={() => goToAddress(getAddress(vi))}>
                                {getAddress(vi)}
                              </SpanLink>
                            ) : (
                              <span>Unparsed address</span>
                            )}

                            {showDetails && (
                              <>
                                <TextElipsis>
                                  <b>Tx ID </b>
                                  <SpanLink
                                    onClick={() =>
                                      goToTx(item.mintTxid, undefined, item.mintIndex)
                                    }>
                                    {item.mintTxid}
                                  </SpanLink>
                                </TextElipsis>

                                <TextElipsis>
                                  <b>Tx Index</b> {item.mintIndex}
                                </TextElipsis>

                                {item.uiConfirmations && confirmations > 0 ? (
                                  <ScriptText>
                                    <b>Confirmations</b> {item.uiConfirmations + confirmations}
                                  </ScriptText>
                                ) : null}

                                {item.script &&
                                  <>
                                    <b>Script Hex</b>
                                    <ScriptText>{item.script}</ScriptText>
                                    <b>Script ASM</b>
                                    <ScriptText>{new lib.Script(item.script).toASM()}</ScriptText>
                                  </>
                                }
                              </>
                            )}
                          </TileDescription>

                          <TileDescription value textAlign='right'>
                            {getConvertedValue(item.value, currency)} {currency}
                          </TileDescription>
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
                <Tile invertedBorderColor={outputsLength > 1 && outputsLength !== i + 1}>
                  <TileDescription padding='0 1rem 0 0' value>
                    {getAddress(vo) !== 'Unparsed address' ? (
                      <SpanLink onClick={() => goToAddress(getAddress(vo))}>
                        {getAddress(vo)}
                      </SpanLink>
                    ) : (
                      <span>{isOpReturn(vo) ? 'OP_RETURN' : 'Unparsed address'}</span>
                    )}

                    {showDetails && (
                      <>
                        {vo.spentTxid &&
                          <TextElipsis>
                            <b>Spent By </b>
                            <SpanLink onClick={() => goToTx(vo.spentTxid, transaction.txid, i)}>
                              {vo.spentTxid}
                            </SpanLink>
                          </TextElipsis>
                        }
                        {isOpReturn(vo) &&
                          <ScriptText>{getOpReturnText(vo)}</ScriptText>
                        }
                        {vo.script &&
                          <>
                          <b>Script Hex</b><ScriptText>{new lib.Script(vo.script).toHex()}</ScriptText>
                          <b>Script ASM</b><ScriptText>{new lib.Script(vo.script).toASM()}</ScriptText>
                          </>
                        }
                      </>
                    )}
                  </TileDescription>

                  <TileDescription value textAlign='right'>
                    {getConvertedValue(vo.value, currency)} {currency}{' '}
                    {vo.spentTxid ? '(S)' : '(U)'}
                  </TileDescription>

                  {showDetails && vo.spentTxid && (
                    <ArrowDiv margin='auto 0 auto .5rem'>
                      <img
                        src={ArrowSvg}
                        width={17}
                        height={17}
                        alt='arrow'
                        onClick={() => goToTx(vo.spentTxid, transaction.txid, i)}
                      />
                    </ArrowDiv>
                  )}
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
