import {FC, memo} from 'react';
import {determineInputType, searchValue} from 'src/utilities/search-helper-methods';
import {useNavigate} from 'react-router-dom';
import styled, {useTheme} from 'styled-components';
import SearchLightSvg from 'src/assets/images/search-light.svg';
import SearchDarkSvg from 'src/assets/images/search-dark.svg';
import {LightBlack, Slate} from '../assets/styles/colors';
import {useAppSelector} from '../utilities/hooks';

interface SearchInputProps {
  searchIcon: string;
  borderBottom?: any;
}

const SearchInput = styled.input<SearchInputProps>`
  background: url(${({searchIcon}) => searchIcon}) no-repeat scroll 7px 7px;
  padding-left: 40px;
  border-bottom: ${({borderBottom, theme: {colors}}) =>
    borderBottom ? `1px solid ${colors.borderColor}` : 'none'};
  border-top: none;
  border-left: none;
  border-right: none;
  height: 40px;
  width: 100%;
  font-size: 16px;
  line-height: 25px;
  color: ${({theme: {dark}}) => (dark ? Slate : LightBlack)};

  &:focus-visible {
    outline: none;
  }

  &:focus {
    outline: none;
  }
`;

const SearchForm = styled.form`
  width: 100%;
`;

interface SearchProps {
  borderBottom?: boolean;
  id?: string;
  setErrorMessage?: any;
}
const Search: FC<SearchProps> = ({borderBottom, id, setErrorMessage}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const {currency, network} = useAppSelector(({APP}) => APP);

  const searchIcon = theme.dark ? SearchDarkSvg : SearchLightSvg;
  const searchId = id || 'search';

  const search = async (event: any) => {
    event.preventDefault();
    setErrorMessage('');
    const searchVal = event.target[searchId].value.replace(/\s/g, '');

    const searchInputs = await determineInputType(searchVal);
    if (searchInputs.length) {
      try {
        const val = await searchValue(searchInputs, currency, network);
        processAllResponse(val, searchVal);
      } catch (e) {
        setErrorMessage('Server error. Please try again');
        clearErrorMsg();
      }
      event.target[searchId].value = '';
    } else {
      setErrorMessage('Invalid search, please search for an address, transaction, or block');
      clearErrorMsg();
    }
  };

  const processAllResponse = (response: any, searchVal: string) => {
    const resFiltered = response.filter((o: any) => {
      return (
        typeof o !== 'string' &&
        !(
          (o.addr && o.addr.length === 0) ||
          (o.block && o.block.length === 0) ||
          (o.tx && o.tx.length === 0)
        )
      );
    });

    if (resFiltered.length !== 0) {
      const matches: {blocks: any[]; txs: any[]; addresses: any[]} = {
        blocks: [],
        txs: [],
        addresses: [],
      };

      resFiltered.map((res: any) => {
        res.block
          ? matches.blocks.push(res.block)
          : res.tx
          ? matches.txs.push(res.tx)
          : matches.addresses.push(res.addr[0]);
        return res;
      });

      // ETH addresses doesn't have 'address' property
      if (matches.addresses.length > 0) {
        matches.addresses.forEach(addr => {
          if (!addr.address) {
            addr.address = searchVal;
          }
        });
      }

      // Skip results screen if there is only one result
      const totalMatches = matches.addresses.length + matches.txs.length + matches.blocks.length;
      if (totalMatches === 1) {
        if (matches.addresses.length) {
          navigate(
            `/${matches.addresses[0].chain}/${matches.addresses[0].network}/address/${matches.addresses[0].address}`,
          );
        } else if (matches.txs.length) {
          navigate(`/${matches.txs[0].chain}/${matches.txs[0].network}/tx/${matches.txs[0].txid}`, {
            state: {transactionData: matches.txs[0]},
          });
        } else {
          navigate(
            `/${matches.blocks[0].chain}/${matches.blocks[0].network}/block/${matches.blocks[0].hash}`,
          );
        }
      } else {
        sessionStorage.setItem('matches', JSON.stringify(matches));
        navigate('/search');
      }
    } else {
      const message = 'No matching records found!';
      if (currency) {
        // Give the user currency specific error since search is limited to one chain/network
        setErrorMessage(
          `No matching records found on the ${currency} ${network}. Select a different chain or try a different search`,
        );
        clearErrorMsg();
      } else {
        setErrorMessage(message);
        clearErrorMsg();
      }
    }
  };

  const clearErrorMsg = () => {
    setTimeout(() => {
      setErrorMessage('');
    }, 3000);
  };

  return (
    <>
      <SearchForm onSubmit={search}>
        <SearchInput
          id={id || 'search'}
          type='text'
          placeholder='Search for block, transaction, or address'
          required
          aria-labelledby='search'
          searchIcon={searchIcon}
          borderBottom={borderBottom}
          tabIndex={0}
          autoComplete='off'
          autoCorrect='off'
          spellCheck='false'
        />
      </SearchForm>
    </>
  );
};

export default memo(Search);
