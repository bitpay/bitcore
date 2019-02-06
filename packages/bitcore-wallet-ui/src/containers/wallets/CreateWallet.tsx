import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import classnames from 'classnames';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import Collapse from '@material-ui/core/Collapse';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddIcon from '@material-ui/icons/Add';
import { Typography } from '@material-ui/core';
import Button from '@material-ui/core/Button';

const styles = (theme: any) => ({
  root: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    color: 'white'
  },
  card: {
    maxWidth: 400
  },
  expand: {
    color: 'white',
    transform: 'rotate(0deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest
    })
  },
  expandOpen: {
    transform: 'rotate(180deg)'
  },
  avatar: {
    backgroundColor: '#1A3A8B'
  },
  cardContent: {
    backgroundColor: 'white'
  },
  button: {
    width: '100%',
    backgroundColor: '#4683e8',
    height: 55
  }
});

interface Props {
  walletCreate: any;
  classes: any;
  handleCreateWalletClick: any;
}

interface State {
  expanded: boolean;
}

class CreateWallet extends React.Component<Props, State> {
  state = { expanded: false };

  handleExpandClick = () => {
    this.setState(state => ({ expanded: !state.expanded }));
  };

  render() {
    const { classes, walletCreate, handleCreateWalletClick } = this.props;

    return (
      <div>
        <CardHeader
          avatar={
            <Avatar aria-label="Add" className={classes.avatar}>
              <AddIcon />
            </Avatar>
          }
          action={
            <IconButton
              className={classnames(classes.expand, {
                [classes.expandOpen]: this.state.expanded
              })}
              onClick={this.handleExpandClick}
              aria-expanded={this.state.expanded}
              aria-label="Show more"
            >
              <ExpandMoreIcon />
            </IconButton>
          }
          title={
            <Typography variant="title" className={classes.title}>
              Create new vault
            </Typography>
          }
          className={classes.root}
        />
        <Collapse in={this.state.expanded} timeout="auto" unmountOnExit>
          <CardContent className={classes.cardContent}>
            {walletCreate()}
          </CardContent>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            className={this.props.classes.button}
            onClick={handleCreateWalletClick}
          >
            Create
          </Button>
        </Collapse>
      </div>
    );
  }
}

const CreateWalletCard = withStyles(styles)(CreateWallet);

export { CreateWalletCard };
