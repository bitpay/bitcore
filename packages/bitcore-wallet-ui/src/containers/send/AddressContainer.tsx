import React from 'react';
import PropTypes from 'prop-types';
import { Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import InputBase from '@material-ui/core/InputBase';
import { Paper } from '@material-ui/core';

const styles = (theme: Theme) => ({
  root: {
    marginTop: '21em',
    background: 'rgba(0,0,0,.07)',
    padding: 0,
    width: '100%'
  },
  root2: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: '#1A3A8B',
    color: 'white',
    marginTop: '.8em',
    marginBottom: '5em'
  },
  margin: {
    margin: theme.spacing.unit
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

export interface Props extends WithStyles<typeof styles> {}

function AddressCard(props: Props) {
  const { classes } = props;

  return (
    <div className={classes.padding}>
      <Paper className={classes.root}>
        <div className={classes.listRoot}>
          <InputBase
            className={classes.margin}
            type="tel"
            defaultValue="0.00 BTC"
          />
        </div>
      </Paper>
    </div>
  );
}

AddressCard.propTypes = {
  classes: PropTypes.object.isRequired
} as any;

export const AddressListCard = withStyles(styles)(AddressCard);
