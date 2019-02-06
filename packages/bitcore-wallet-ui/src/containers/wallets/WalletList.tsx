import React from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { Wallet } from 'bitcore-client';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';

interface Props {
  wallet: Wallet;
}

const icons: { [chain: string]: string } = {
  BTC: 'bitcoin',
  ETH: 'ethereum'
};

export function WalletList(props: Props) {
  const { wallet } = props;
  return (
    <Link to={`/wallet/${wallet.name}`}>
      <ListItem>
        <ListItemIcon>
          <Icon name={icons[wallet.chain] as any} />
        </ListItemIcon>
        <ListItemText
          primary={wallet.name}
          secondary={`${wallet.chain} ${wallet.network}`}
        />
      </ListItem>
    </Link>
  );
}
