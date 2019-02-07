import React from 'react';
import { Wallet } from 'bitcore-client';
import { Link } from 'react-router-dom';
import { withStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';

interface Props {
  e: number;
  classes: any;
  // t: object;
}

const styles = (theme: any) => ({
  paper: {
    maxWidth: 600,
    padding: theme.spacing.unit * 2,
    alignItems: 'center',
    borderTop: '2px solid green'
  } as any,
  textRight: {
    textAlign: 'right'
  } as any,
  avatar: {
    backgroundColor: 'white',
    color: 'green',
    border: '1px solid green',
    margin: 'auto'
  },
  auto: {
    margin: 'auto'
  } as any,
  default: {
    color: 'black'
  },
  green: {
    color: 'green'
  }
});

function Transactions(props: Props) {
  const { classes } = props;
  return (
    <Link
      to={'/wallet'}
      // to={`${API_URL}/${this.state.wallet!.chain}/${
      //   this.state.wallet!.network
      // }/tx/${t.txid}`}
    >
      <Paper className={classes.paper}>
        <Grid container wrap="nowrap" spacing={16}>
          <Grid item className={classes.auto}>
            <Avatar className={classes.avatar}>
              {true ? <ArrowUpwardIcon /> : <RefreshIcon />}
            </Avatar>
          </Grid>
          <Grid item xs zeroMinWidth className={classes.auto}>
            <Typography noWrap variant="h6" className={classes.status}>
              {/* {t.height > 0 ? `Block: ${t.height}` : 'Confirming:'}{' '} */}
            </Typography>
          </Grid>
          <Grid item className={classes.textRight}>
            <Typography
              variant="subtitle1"
              className={true ? classes.green : classes.default}
            >
              {/* {t.value / 1e8 || t.satoshis / 1e8} BTC */}
              0.001231 BTC
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              {/* {t.blockTime} */}
              November 15, 2018
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Link>
  );
}

const TransactionList = withStyles(styles)(Transactions);

export { TransactionList };
