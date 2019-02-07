import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { TransactionList } from './TransactionList';
import { Wallet } from 'bitcore-client';

const styles = (theme: any) => ({
  root: {
    marginTop: '15em',
    background: 'rgba(0,0,0,.07)',
    padding: 0
  },
  root2: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: '#1A3A8B',
    color: 'white',
    marginTop: '.8em',
    marginBottom: '5em'
  },
  padding: {
    margin: 'auto',
    maxWidth: 600,
    marginBottom: 80
  },
  listRoot: {
    flexGrow: 1,
    maxWidth: 600
  },
  demo: {
    backgroundColor: theme.palette.background.paper
  }
});

interface Props {
  classes: any;
  transactions: any;
  API_URL: string;
  wallet: Wallet;
}

function TransactionCard(props: Props) {
  const { classes, transactions, wallet, API_URL } = props;

  return (
    <div className={classes.padding}>
      <div className={classes.root}>
        <div className={classes.listRoot}>
          {transactions
            .slice(0)
            .reverse()
            .map((tx: any, i: number) => (
              <TransactionList
                key={i}
                tx={tx}
                wallet={wallet}
                API_URL={API_URL}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

TransactionCard.propTypes = {
  classes: PropTypes.object.isRequired
};

const TransactionListCard = withStyles(styles)(TransactionCard);

export { TransactionListCard };
