import React from 'react';
import { Theme, withStyles, createStyles } from '@material-ui/core/styles';
import { TransactionList } from '../../components/activity/TransactionList';
import { AppState } from '../../types/state';

const styles = (theme: Theme) =>
  createStyles({
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
  transactions: AppState['transactions'];
  wallet?: AppState['wallet'];
}

function TransactionCard(props: Props) {
  const { classes, transactions, wallet } = props;

  return (
    <div className={classes.padding}>
      <div className={classes.root}>
        <div className={classes.listRoot}>
          {transactions
            .slice(0)
            .reverse()
            .map((tx: any, i: number) => (
              <TransactionList key={i} tx={tx} wallet={wallet} />
            ))}
        </div>
      </div>
    </div>
  );
}

export const TransactionListCard = withStyles(styles)(TransactionCard);
