import React from 'react';
import PropTypes from 'prop-types';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { WalletList } from '../../components/wallets/WalletList';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import { Wallet } from 'bitcore-client';
import { CreateWalletCard } from '../../components/wallets/CreateWallet';

const styles = (theme: Theme) =>
  createStyles({
    root: {
      ...theme.mixins.gutters(),
      paddingTop: theme.spacing.unit * 2,
      paddingBottom: theme.spacing.unit * 2,
      marginTop: 70
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
      maxWidth: 600
    },
    listRoot: {
      flexGrow: 1,
      maxWidth: 752,
      paddingTop: theme.spacing.unit * 2,
      paddingBottom: theme.spacing.unit * 2
    },
    demo: {
      backgroundColor: theme.palette.background.paper
    }
  });

export interface Props extends WithStyles<typeof styles> {
  wallets: Wallet[];
  classes: any;
  walletCreate: any;
  handleCreateWalletClick: any;
}

function WalletCard(props: Props) {
  const { classes, wallets, walletCreate, handleCreateWalletClick } = props;

  return (
    <div className={classes.padding}>
      <Paper className={classes.root} elevation={1}>
        <Typography variant="h5" component="h3" className={classes.padding}>
          Wallets
        </Typography>
        <div className={classes.listRoot}>
          <Grid item xs={12} md={6}>
            <div className={classes.demo}>
              <List>
                {wallets.map((e: Wallet, i: number) => (
                  <WalletList key={i} wallet={e} />
                ))}
              </List>
            </div>
          </Grid>
        </div>
      </Paper>
      <Paper className={classes.root2} elevation={1}>
        <CreateWalletCard
          walletCreate={walletCreate}
          handleCreateWalletClick={handleCreateWalletClick}
        />
      </Paper>
    </div>
  );
}

WalletCard.propTypes = {
  classes: PropTypes.object.isRequired
};

export const WalletListCard = withStyles(styles)(WalletCard);
