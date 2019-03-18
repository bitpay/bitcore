import React from 'react';
import { Wallet } from 'bitcore-client';
import { withStyles, Theme, createStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import moment from 'moment';
import { AppState } from '../../types/state';
import { Constants } from '../../constants';

interface Props {
  tx: AppState['transactions'][0];
  classes: any;
  wallet?: Wallet;
}

const styles = (theme: Theme) =>
  createStyles({
    paper: {
      maxWidth: 600,
      padding: theme.spacing.unit * 2,
      alignItems: 'center',
      borderTop: '2px solid #002855'
    },
    textRight: {
      textAlign: 'right'
    },
    avatar: {
      backgroundColor: 'white',
      color: '#002855',
      border: '1px solid #002855',
      margin: 'auto'
    },
    auto: {
      margin: 'auto'
    },
    default: {
      color: '#002855'
    },
    green: {
      color: 'green'
    },
    blue: {
      color: 'blue'
    },
    red: {
      color: 'red'
    },
    link: {
      color: 'white',
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'none'
      }
    }
  });

function Transactions(props: Props) {
  const { classes, tx, wallet } = props;
  let statusColor = 'default';

  const filterCategory = () => {
    switch (tx.category) {
      case 'receive':
        tx.height > 0 ? (statusColor = 'green') : (statusColor = 'default');
        return (
          <Typography noWrap variant="h6" className={classes[statusColor]}>
            {tx.height > 0 ? `Recieved Block: ${tx.height}` : 'Confirming'}
          </Typography>
        );
      case 'send':
        tx.height > 0 ? (statusColor = 'red') : (statusColor = 'default');
        return (
          <Typography noWrap variant="h6" className={classes[statusColor]}>
            {tx.height > 0 ? `Sent Block: ${tx.height}` : 'Confirming'}
          </Typography>
        );
      case 'transfer':
        tx.height > 0 ? (statusColor = 'blue') : (statusColor = 'default');
        return (
          <Typography noWrap variant="h6" className={classes[statusColor]}>
            {tx.height > 0 ? `Token Transfer Block ${tx.height}` : 'Confirming'}{' '}
          </Typography>
        );
    }
  };
  return (
    <a
      href={
        wallet
          ? `http://localhost:8200/#/home/${wallet.chain}/${
              wallet.network
            }/tx/${tx.txid}`
          : ''
      }
    >
      <Paper className={classes.paper}>
        <Grid container wrap="nowrap" spacing={16}>
          <Grid item className={classes.auto}>
            <Avatar className={classes.avatar}>
              {tx.height > 0 ? <ArrowUpwardIcon /> : <RefreshIcon />}
            </Avatar>
          </Grid>
          <Grid item xs zeroMinWidth className={classes.auto}>
            {filterCategory()}
          </Grid>
          <Grid item className={classes.textRight}>
            <Typography variant="subtitle1" className={classes[statusColor]}>
              {tx.satoshis / Constants[tx.chain]} {tx.chain}
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              {moment(tx.blockTime).fromNow()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </a>
  );
}

export const TransactionList = withStyles(styles)(Transactions);
