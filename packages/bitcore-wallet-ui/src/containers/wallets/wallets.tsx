import React, { Component } from 'react';
import { Button, Comment, Form, Header } from 'semantic-ui-react';
import { RouteComponentProps } from 'react-router';
import { Wallet, Storage } from 'bitcore-client';
import {
  Icon,
  Accordion,
  Grid,
  Card,
  List,
  Input,
  Select,
  Divider
} from 'semantic-ui-react';
import { DropdownProps } from 'semantic-ui-react/dist/commonjs/modules/Dropdown/Dropdown';
import './wallets.css';

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

interface Props {}
interface State {
  creating: boolean;
  selectedChain: string;
  selectedNetwork: string;
  newWalletName: string;
  newWalletPassword: string;
  wallet?: Wallet;
  wallets: Wallet[];
}

const icons: { [chain: string]: string } = {
  BTC: 'bitcoin',
  ETH: 'ethereum'
};

export class WalletsContainer extends Component<Props, State> {
  state: State = {
    creating: false,
    wallets: [],
    newWalletName: '',
    newWalletPassword: '',
    selectedChain: 'BTC',
    selectedNetwork: 'mainnet'
  };
  constructor(props: Props) {
    super(props);
    this.handleChainChange = this.handleChainChange.bind(this);
    this.handleNetworkChange = this.handleNetworkChange.bind(this);
    this.handleWalletNameChange = this.handleWalletNameChange.bind(this);
    this.handleWalletPasswordChange = this.handleWalletPasswordChange.bind(
      this
    );
    this.handleCreateWalletClick = this.handleCreateWalletClick.bind(this);
  }

  async componentDidMount() {
    const wallet = await this.createOrLoadWallet();
    this.setState({ wallet });
    const wallets = this.state.wallet!.storage.listWallets();
    this.state.wallet!.storage.listWallets().on('data', (walletBuf: Buffer) => {
      const walletStr = walletBuf.toString();
      const foundWallet = JSON.parse(walletStr);
      this.setState({ wallets: [...this.state.wallets, foundWallet] });
      console.log(foundWallet);
    });
  }

  addWalletToState(wallet: Wallet) {
    this.setState({ wallets: [...this.state.wallets, wallet] });
  }

  async createOrLoadWallet() {
    const testWallet = {
      name: 'BitcoreWallet',
      chain: 'BTC',
      network: 'regtest',
      baseUrl: API_URL,
      password: 'iamsatoshi'
    };
    let wallet: Wallet | undefined;
    try {
      const exists = await Wallet.exists(testWallet);
      if (!exists) {
        console.log('Wallet needs to be created');
        wallet = await Wallet.create(testWallet);
      } else {
        console.log('Wallet exists');
        wallet = await Wallet.loadWallet(testWallet);
      }
    } catch (err) {
      console.log(err);
    }
    return wallet;
  }

  walletListItemComponent(wallet: Wallet) {
    return (
      <List.Item
        key={wallet.name}
        className="walletListItemContainer"
      >
        <Grid columns={6} relaxed>
          <Grid.Column width={1}>
            <List.Icon
              name={icons[wallet.chain] as any}
              size="large"
              verticalAlign="middle"
            />
          </Grid.Column>
          <Grid.Column width={12}>
            <List.Content>
              <List.Header>
                <a href={`/wallet/${wallet.name}`}> {wallet.name}</a>
              </List.Header>
              <List.Description>
                <a href={`/wallet/${wallet.name}`}>
                  {wallet.chain} {wallet.network} wallet
                </a>
              </List.Description>
            </List.Content>
          </Grid.Column>
        </Grid>
      </List.Item>
    );
  }

  handleChainChange(
    event: React.SyntheticEvent<HTMLElement, Event>,
    data: DropdownProps
  ) {
    this.setState({ selectedChain: data.value as string });
  }

  handleNetworkChange(
    event: React.SyntheticEvent<HTMLElement, Event>,
    data: DropdownProps
  ) {
    this.setState({ selectedNetwork: data.value as string });
  }

  async handleCreateWalletClick() {
    const wallet = await Wallet.create({
      name: this.state.newWalletName,
      password: this.state.newWalletPassword,
      chain: this.state.selectedChain,
      network: this.state.selectedNetwork
    });
    this.addWalletToState(wallet);
  }

  walletListComponent(wallets: Wallet[]) {
    const walletComponents = wallets.map(this.walletListItemComponent);
    console.log(walletComponents);
    return (
      <div>
        <List divided={true} relaxed={true}>
          {walletComponents}
        </List>
      </div>
    );
  }

  handleWalletNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newWalletName: event.target.value });
  }

  handleWalletPasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newWalletPassword: event.target.value });
  }
  walletCreateComponent() {
    const options = [
      { key: 'BTC', text: 'Bitcoin', value: 'BTC' },
      { key: 'BCH', text: 'Bitcoin Cash', value: 'BCH' },
      { key: 'ETH', text: 'Ethereum', value: 'ETH' }
    ];
    const chainNetworks: {
      [chain: string]: { key: string; text: string; value: string }[];
    } = {
      BTC: [
        { key: 'mainnet', text: 'Mainnet', value: 'mainnet' },
        { key: 'testnet', text: 'Testnet', value: 'testnet' },
        { key: 'regtest', text: 'Regtest', value: 'regtest' }
      ],
      BCH: [
        { key: 'mainnet', text: 'Mainnet', value: 'mainnet' },
        { key: 'testnet', text: 'Testnet', value: 'testnet' },
        { key: 'regtest', text: 'Regtest', value: 'regtest' }
      ],
      ETH: [{ key: 'mainnet', text: 'Mainnet', value: 'mainnet' }]
    };
    const networks = chainNetworks[this.state.selectedChain] || [];
    return (
      <div className="walletCreateContainer">
        <Input
          fluid
          type="text"
          placeholder="Wallet Name"
          onChange={this.handleWalletNameChange}
        />
        <Input
          fluid
          type="text"
          placeholder="Wallet Password"
          onChange={this.handleWalletPasswordChange}
        />
        <div>
          <Select
            fluid
            options={options}
            defaultValue="BTC"
            onChange={this.handleChainChange}
          />
          <Select
            fluid
            options={networks}
            defaultValue="mainnet"
            onChange={this.handleNetworkChange}
          />
        </div>
        <Button
          fluid
          primary
          type="submit"
          onClick={this.handleCreateWalletClick}
        >
          Create
        </Button>
      </div>
    );
  }

  render() {
    const walletList = this.walletListComponent(this.state.wallets);
    return (
      <div className="walletContainer">
        <Card>
          <h1> Wallets </h1>
          <Divider />
          <div>{walletList}</div>
          <Accordion fluid styled>
            <Accordion.Title
              onClick={() => this.setState({ creating: !this.state.creating })}
              active={this.state.creating}
            >
              <Icon name="dropdown" />
              New Wallet
            </Accordion.Title>
            <Accordion.Content active={this.state.creating}>
              <div>{this.walletCreateComponent()}</div>
            </Accordion.Content>
          </Accordion>
        </Card>
      </div>
    );
  }
}
