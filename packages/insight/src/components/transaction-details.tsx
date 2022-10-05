import {Transaction} from '../utilities/models';
import {
  aggregateItems,
  getAddress,
  getConvertedValue,
  getFormattedDate,
  hasUnconfirmedInputs,
  isRBF,
} from '../utilities/helper-methods';
import {useState, useEffect} from 'react';
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

const TextElipsis = styled(ScriptText)`
  overflow: hidden;
  text-overflow: ellipsis; ;
`;

const TransactionDetails = ({
  transaction,
  currency,
  network,
}: {
  transaction: Transaction;
  currency: string;
  network: string;
}) => {
  const navigate = useNavigate();
  const [formattedInputs, setFormattedInputs] = useState<any[]>();
  const {outputs, txid, blockTime, coinbase, inputs, confirmations, fee, value} = transaction;

  const goToAddress = (address: any) => {
    return navigate(`/${currency}/${network}/address/${address}`);
  };

  const goToTx = (tx: any, detailsIdx?: number, fromVout?: boolean) => {
    return navigate({
      pathname: `/${currency}/${network}/tx/${tx}`,
      search: `?${createSearchParams({
        detailsIdx: detailsIdx !== undefined ? detailsIdx.toString() : '',
        fromVout: fromVout ? 'true' : 'false',
      })}`,
    });
  };

  const outputsLength = outputs.length;

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!inputs) {
      return;
    }
    setFormattedInputs(aggregateItems(inputs));
  }, [inputs]);

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
          Mined on: {getFormattedDate(blockTime)}
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
                      <Tile
                        key={item.mintTxid}
                        invertedBorderColor={arr.length > 1 && arr.length !== i + 1}>
                        {showDetails && (
                          <ArrowDiv margin='auto .5rem auto 0'>
                            <img
                              src={ArrowSvg}
                              width={17}
                              height={17}
                              alt='arrow'
                              onClick={() => goToTx(item.mintTxid, item.mintIndex, false)}
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
                              {item.uiConfirmations && confirmations > 0 ? (
                                <ScriptText>
                                  <b>Confirmations</b> {item.uiConfirmations + confirmations}
                                </ScriptText>
                              ) : null}

                              <TextElipsis>
                                <b>Tx ID </b>
                                <SpanLink
                                  onClick={() => goToTx(item.mintTxid, item.mintIndex, false)}>
                                  {item.mintTxid}
                                </SpanLink>
                              </TextElipsis>

                              <TextElipsis>
                                <b>Tx Index</b> {item.mintIndex}
                              </TextElipsis>

                              {item.scriptSig && <ScriptText>{item.scriptSig.asm}</ScriptText>}
                            </>
                          )}
                        </TileDescription>

                        <TileDescription value textAlign='right'>
                          {getConvertedValue(item.value, currency)} {currency}
                        </TileDescription>
                      </Tile>
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
              <Tile key={i} invertedBorderColor={outputsLength > 1 && outputsLength !== i + 1}>
                <TileDescription padding='0 1rem 0 0' value>
                  {getAddress(vo) !== 'Unparsed address' ? (
                    <SpanLink onClick={() => goToAddress(getAddress(vo))}>
                      {getAddress(vo)}
                    </SpanLink>
                  ) : (
                    <span>Unparsed address</span>
                  )}

                  {showDetails && (
                    <>
                      {vo.script.type ? (
                        <ScriptText>
                          <b>Script Template</b>
                          <i>{vo.script.type}</i>
                        </ScriptText>
                      ) : null}
                      {vo.script.asm ? <ScriptText>{vo.script.asm}</ScriptText> : null}
                      {showDetails && vo.spentTxid && vo.spentTxid !== '' ? (
                        <TextElipsis>
                          <b>Tx ID </b>
                          <SpanLink onClick={() => goToTx(vo.spentTxid)}>
                            {vo.spentTxid}
                          </SpanLink>
                        </TextElipsis>
                      ) : null}
                    </>
                  )}
                </TileDescription>

                <TileDescription value textAlign='right'>
                  {getConvertedValue(vo.value, currency)} {currency} {vo.spentTxid ? '(S)' : '(U)'}
                </TileDescription>

                {showDetails && vo.spentTxid && vo.spentTxid !== '' && (
                  <ArrowDiv margin='auto 0 auto .5rem'>
                    <img
                      src={ArrowSvg}
                      width={17}
                      height={17}
                      alt='arrow'
                      onClick={() => goToTx(vo.spentTxid)}
                    />
                  </ArrowDiv>
                )}
              </Tile>
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

export default TransactionDetails;
