import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { AddressList } from '../Address/AddressList';

const styles = (theme: any) => ({
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
  address: any[];
}

function AddressCard(props: Props) {
  const { classes, address } = props;

  return (
    <div className={classes.padding}>
      <div className={classes.root}>
        <div className={classes.listRoot}>
          {address
            .slice(0)
            .reverse()
            .map((address: any, i: number) => (
              <AddressList key={i} address={address} />
            ))}
        </div>
      </div>
    </div>
  );
}

AddressCard.propTypes = {
  classes: PropTypes.object.isRequired
};

const AddressListCard = withStyles(styles)(AddressCard);

export { AddressListCard };
