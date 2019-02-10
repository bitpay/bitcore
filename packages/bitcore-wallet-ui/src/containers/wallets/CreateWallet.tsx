import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddIcon from '@material-ui/icons/Add';
import { Typography, ExpansionPanel } from '@material-ui/core';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpansionPanelActions from '@material-ui/core/ExpansionPanelActions';
import Divider from '@material-ui/core/Divider';
import { connect } from 'react-redux';
import { fetchPostsandUpdate } from '../../actions';
import { AppState } from '../../contexts/state';

const styles = () => ({
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

interface Props {
  walletCreate: any;
  classes: any;
  handleCreateWalletClick: any;
  fetchPostsandUpdate: any;
}

class CreateWallet extends React.Component<Props> {
  componentDidMount() {
    this.props.fetchPostsandUpdate();
  }

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

const mapStateToProps = (state: AppState) => {
  return { posts: state.postReducer };
};

const CreateWalletCard = withStyles(styles)(
  connect(
    mapStateToProps,
    { fetchPostsandUpdate }
  )(CreateWallet)
);

export { CreateWalletCard };
