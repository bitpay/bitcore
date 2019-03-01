import React from 'react';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddIcon from '@material-ui/icons/Add';
import { Typography, ExpansionPanel } from '@material-ui/core';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpansionPanelActions from '@material-ui/core/ExpansionPanelActions';
import Divider from '@material-ui/core/Divider';
import { createStyles, withStyles, WithStyles } from '@material-ui/core/styles';

const styles = () =>
  createStyles({
    root: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1A3A8B',
      height: 70
    },
    white: {
      color: 'white'
    },
    heading: {
      margin: 'auto',
      color: 'white'
    },
    action: {
      width: '100%',
      backgroundColor: '#4683e8',
      height: 55,
      justifyContent: 'center',
      color: 'white',
      cursor: 'pointer'
    }
  });

interface Props extends WithStyles<typeof styles> {
  walletCreate: any;
  classes: any;
  handleCreateWalletClick: any;
}

class CreateWallet extends React.Component<Props> {
  render() {
    const { classes, walletCreate, handleCreateWalletClick } = this.props;

    return (
      <div>
        <ExpansionPanel>
          <ExpansionPanelSummary
            className={classes.root}
            expandIcon={<ExpandMoreIcon className={classes.white} />}
          >
            <AddIcon aria-label="Add" className={classes.avatar} />
            <Typography variant="title" className={classes.heading}>
              Create new wallet
            </Typography>
          </ExpansionPanelSummary>
          <ExpansionPanelDetails className={classes.cardContent}>
            {walletCreate()}
          </ExpansionPanelDetails>
          <Divider />
          <ExpansionPanelActions
            className={classes.action}
            onClick={handleCreateWalletClick}
          >
            <Typography variant="subtitle1" className={classes.white}>
              Create
            </Typography>
          </ExpansionPanelActions>
        </ExpansionPanel>
      </div>
    );
  }
}

export const CreateWalletCard = withStyles(styles)(CreateWallet);
