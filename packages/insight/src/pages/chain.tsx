import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "src/api/api";
import ChainHeader from "src/components/chain-header";
import { changeCurrency, changeNetwork } from "src/store/app.actions";
import { getApiRoot, getDefaultRefreshInterval, normalizeParams } from "src/utilities/helper-methods";


export const ChainDetails = () => {
    const params = useParams<{currency: string, network: string}>()
    let {currency, network} = params;

    const navigate = useNavigate();
    const dispatch = useDispatch();

    if (currency) {
        const apiRoot = getApiRoot(currency);
        const refreshInterval = getDefaultRefreshInterval(currency);
        const {data, error} = useApi(`${apiRoot}/${currency}/mainnet/block?limit=1`, {refreshInterval});
        if (data) {
            const {height, time, transactionCount, size} = data[0];

        }

    }

    useEffect(() => {
        if (!currency || !network) return;

        const normalizedParams = normalizeParams(currency, network);
        currency = normalizedParams.currency;
        network = normalizedParams.network;
        dispatch(changeCurrency(currency));
        dispatch(changeNetwork(network));

    }, [currency, network]);
    
    const {data: priceDetails} = useApi(`https://bitpay.com/rates/${currency}/usd`);
    const price = priceDetails?.data?.rate;
    
    const gotoBlocks = async () => {
        await navigate(`/${currency}/mainnet/blocks`);
    }

    return (
        <>
            {currency && network && <ChainHeader currency={currency} network={network} />}
            <div style={{display: 'flex'}}>
                <div onClick={(gotoBlocks)}>Go to full block list</div>
            </div>
        </>
    );
}
