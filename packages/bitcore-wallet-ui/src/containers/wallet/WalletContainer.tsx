import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import { TransactionList } from './WalletList';
import { Wallet } from 'bitcore-client';

const styles = (theme: any) => ({
  root: {
    marginTop: '13em',
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
    padding: 20,
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
}
const array = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5];

function TransactionCard(props: Props) {
  const { classes } = props;

  return (
    <div className={classes.padding}>
      <div className={classes.root}>
        <div className={classes.listRoot}>
          {array.map((e, i: number) => (
            <TransactionList key={i} e={e} />
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
