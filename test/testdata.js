var keyPair = {
  priv: '0dea92f1df6675085b5cdd965487bb862f84f2755bcb56fa45dbf5b387a6c4a0',
  pub: '026092daeed8ecb2212869395770e956ffc9bf453f803e700f64ffa70c97a00d80',
};

var message = {
  text: 'hello world',
  signature: '30440220091598edbe4b45d41b551c941f24401fd3d72a8ccd18721dbfc58be9bdc234d802203870d36cf1fee89bb78cf161334849774c5684d287a74a9bd6681ee5e012150d', // Signed with copayer[0].privKey_1H_0 
};

var copayers = [{
  id: 'ec2dd28c76367b6cfbf4a8d7cc17c9473fd78c995092a83e1776e1be43a30dc6',
  xPrivKey: 'xprv9s21ZrQH143K2TjAA6HcG4p2eikKc4qQMVekTPqwNcesQ89nFZHzHKmekbwMKeiK6cPSzmqAavdemUS6VUzhGc5Uf4TCtjBa9qwDfbnWQcJ',
  xPubKey: 'xpub661MyMwAqRbcEwodG7pcdCkmCkap1XZFiiaMFnFYvxBrGvUvo6cEq868bukLYM938wPm1CMzFuvbDQbA2tJvsWKgTz4xDKTyEfbQvBbo1AR',
  xPrivKey_45H: 'xprv9uZiJ2ZYFNQ3RDBvjtz1HcivbfWbncMAb6EvKKose8rUbRo9dwX5hnThGodivCDuV8s48xZk7DZSuNpYb9ZwCpsatsnibRyirQbqqroftMP',
  xPubKey_45H: 'xpub68Z4hY6S5jxLdhGPqvX1ekff9hM6C551xKAX7iDVCUPTUE8JBUqLFanB8697EoXbwN5rjDLHgPWkbofr8otNeb8Kr8SSh8pCiNMp7sWkBj4',
  xPrivKey_1H: 'xprv9uZiJ2ZYFNQ1WeKrKfTxrbUnXfNnCtpbdHVuUMSVGB57nhbmjqWbJBQbgGNa2jSbrgQX9NFHXtAoQ3y1hsEgwjKHxUU52ZYTC6m5kjXoNpJ',
  xPubKey_1H: 'xpub68Z4hY6S5jxJj8QKRgzyDjRX5hDGcMYSzWRWGjr6pWc6fVvvHNpqqyj5XXbMcfW737beYZcd7EQau5HS74Ws6Ctx9XwFn2wHQjSUKLbfdFk',
  privKey_1H_0: 'e334a0ce3d573bd99fc4cd7e2065e39dc7851cb61da7f381431c253c3e230828',
  pubKey_1H_0: '02db35c363e2c904bba3cd0eadb6b8d68fc1d8e6160d632b8fb91a471b80e40c86',
  privKey_1_0: '89833f39998ff14f2cbb461365ccba30583abfd2a7845e0bb61849275802005d',
  pubKey_1_0: '022ef899f914c9b90a5544923a3aa6de5ddcd6c9d0b603b63ab9fd0c2cdc5d3772',
}, {
  id: 'cf652642ebf997460d642231f9929c39257bcd4c42e9ecb312c226961e21c882',
  xPrivKey: 'xprv9s21ZrQH143K2XtR13LpXVAPaGTFsPY5dJfNvNTShfhdVW16vdDaYGjLwHmyKLCtv3F6h9NpKsAGusmKCZNQvKcYqYf9MjCLwJwsoEyAuge',
  xPubKey: 'xpub661MyMwAqRbcF1xt74sptd788JHkGrFvzXayiks4G1EcNJLFUAXq653pncPaLt6vcEARqSHopD8PHT5PWkDryuZNBYpxX5wUdeV7DtgjKoL',
  xPrivKey_45H: 'xprv9v8AzYcRrUwmJQGbDDKXvydEG2NZZDqXn9J3B6au2S8yhLfJyQidhZgMfTpFxBqAkUxgtTDc9JWFt4JaTmwKNLGxr6oSKjpaheQ5EG8jHz6',
  xPubKey_45H: 'xpub697XQ49KgrW4WtM4KErYJ7Zxp4D3xgZP9NDdyUzWamfxa8zTWx2tFMzqWktiJG1yDo6mYpp8NAySfzRS8JoJyz2Br26vARWY9d9QAJdYFYh',
  xPrivKey_1H: 'xprv9v8AzYcRrUwjNBGAL5pzBaLvDBwepj9YVDM5UHjZXYYdoAxi9uaJjALUKPRcMxZZWq265CZuEfhTbwE6BD1tndRGESV4Jbr4c3pLanhnZHm',
  xPubKey_1H: 'xpub697XQ49KgrW2afLdS7MzYiHemDn9EBsPrSGgGg9B5t5cfyHrhStZGxexAdekvK84XDZGunARoEzzHWmPjPwaRkKJwV2KWiRcHxVPfwwWKtg',
  privKey_1H_0: '64274141d3ed98d3ee159409939627bd32229eac8b29cddc4c744c4e7f20235f',
  pubKey_1H_0: '02787e683b17a4729e4e9405f80b74fb19b369133dd1c98b801230ae6603cc28aa'
}, {
  id: 'ff98c0b625e7824219f6a8054470a332ce1bdc9bb5a46a57eb424ed0848c0183',
  xPrivKey: 'xprv9s21ZrQH143K3F4gznfMiq1rFLNAJbWnC9HJdkdrL7xpt4YxeLWRJTPXFvMn5Ky8rqaunWNTxwrLF6Nhptjyq8mAJvmc13R3fRJLDWWmgon',
  xPubKey: 'xpub661MyMwAqRbcFj9A6pCN5xxaoNCei4EdZNCuS93TtTVokrt7BspfrFi17DdM2Z4HYYseVoZ2nmeu5mCvsn8gYGyW94m7EfXQDbXymLw2Yi1',
  xPrivKey_45H: 'xprv9vUaCxyzkmLHHUpZZFUvh9oqzm9R6UMCTsJn8F7mDN3AR7rwLobojATJYgSx3pJjrv3EWCaSYeBjhouiM1m9Y9kAHAku3ZiAxZyWRxQZyHf',
  xPubKey_45H: 'xpub69TvcUWtb8taVxu2fH1w4HkaYnyuVw53q6ENvdXNmha9HvC5tLv4GxmnPxemekKx8jVx7kmbtATgH5KXEMibhpZh7x2NN8AXcwF7FvJmvXo',
  xPrivKey_1H: 'xprv9vUaCxyzkmLFMyQhaN3knpLSWHeqTbNbxVa9cHgJ88m287K6iLazaT5CYBgCaW6PEJy7bKeDZ2Wi8UsWnzND9QtzSy9CFWdgMxZAJ3mP5hW',
  xPubKey_1H: 'xpub69TvcUWtb8tYaTVAgPam9xHB4KVKs46TKiVkQg5ugUHzzueFFsuF8FPgPTLeRcZmq3EwbrnYGX6gHmShDNL1YgNqjo5ctqw5Z7WXe9LSErX',
  privKey_1H_0: '25ac29ca9bffe835bdafed55feebe606c7250e2b399cd3d95347a746dd6d3388',
  pubKey_1H_0: '031a69ea8a3d487743c7d6acdcecc151c685fd25f8f41b327f4c25d8b21f6c80ba'
}, {
  id: 'ab0bc4e4c251376d733d9ba63242fb0ca258b0dff4def1f67e2a5e0441b86a8f',
  xPrivKey: 'xprv9s21ZrQH143K24Vs7f7xhvrMgojXW5444PtT7Qkw3opZ2Dwpxwz5tERpSMtEa4YTgrfDhRqzw8X9b4TnCKrhcoZiPRgJDQaH9Lz8LEvLSpF',
  xPubKey: 'xpub661MyMwAqRbcEYaLDgey54o6Eqa1uXmuRcp3uoAYc9MXu2GyWVJLS2kJHeTLPTohioPuLNadiYZDBRXzzeZLFTvZTgEvrSHDTExFuutcPX3',
  xPrivKey_45H: 'xprv9tzvDbfzt6dy5aiWx2qovpw2sxLUHm5zM3ZBX3AH1oTEa7PjZoHWhfSZp5LnmMayDCHJEM4ATCDWECkQUjgxYjnEczMjyvujwzUAWXNMy8L',
  xPubKey_45H: 'xpub67zGd7CtiUCGJ4nz44NpHxsmRzAxhDoqiGUnKRZta8zDSuit7LbmFTm3fMTBmgk4aiZyGMswwdEiTr3DPwhc6Gu7EEgaDyRk9G6VTTmMNTw',
  xPrivKey_1H: 'xprv9tzvDbfzt6dw8EKieKg6hLykKuvTB4nKocQNp977xoQr6TCxDqqdDf5oK21i3FFjPG2jCtSxuGnJpBYnpmtHEZyRuxuG1RmLC3NVvVKzYEe',
  xPubKey_1H: 'xpub67zGd7CtiUCELiQBkMD74UvUswkwaXWBAqKycXWjX8wpyFY6mP9smTQHAFFY8vUDcEnoUfbgUJsktwQ96igzGNfT22ujQFiSKBFAqzkwpcW',
  privKey_1H_0: '5ff5b3cab4ae8f1487b75ee3b688d0cb54d11db3d21044ae6eaabd04a2a379c9',
  pubKey_1H_0: '030da118db806d1758983ab078c8b5e5651270cba8a587e34337eb0b9b5e555b21'
}, {
  id: '65fa0d2c2bd1d09da631e12c746562687d43364104e65bc7e0009c9cd6efb9f8',
  xPrivKey: 'xprv9s21ZrQH143K44coj9AbkrT5B43PjRY91RnobCw8WGQVY7VvUDDA6VauoYs2PsKrW8MWQb9qUi2KgoWatAKf2qGZLBAT5wo98zxDsm4wog8',
  xPubKey: 'xpub661MyMwAqRbcGYhGqAhc7zPoj5st8tFzNeiQPbLk4bwUQuq51kXQeHuPeqb4wxi8zkrzVThRKkBEGoT5H3M4kfFrdER1BfNCr3AV7rxSHB2',
  xPrivKey_45H: 'xprv9uAoUcLPWHxJS36XQi8Mt3rywiVXK5MsY4bn6hLgyPVb8WDoqW81vvXrN7kwR9r52GTDEs6CZBXdAoEbqEbEsLxPVfCRRFZSzAnXFpaxnoy',
  xPubKey_45H: 'xpub68A9t7sHLfWbeXAzWjfNFBoiVkL1iY5iuHXNu5kJXj2a1JYxP3SGUirLDPueKxxHmee12FBnjcQzspG2f8KkCqoV8vaUiVt75L4Bhsqffep',
  xPrivKey_1H: 'xprv9uAoUcLPWHxGY9eCE8gXxRSTUkVpjfVWg6LQaopBQHvv8LbPCzzQHcu7mi6hWsV6EGnNqPX8xxJSwroeBiRj3TVfsGH2etA6ZNtDZqskL2h',
  xPubKey_1H: 'xpub68A9t7sHLfWZkdifLADYKZPC2nLK98DN3KG1PCDnxdTu18vXkYJeqRDbd1MTj2mBjYPCix49qz2wsBWAKuPZ5crUMLemYPK7mZd5GpF4s8D',
  privKey_1H_0: '259dddf1b0bcc4ab005002de457ce118771cb0ebfa8711f2b65bafec09ccfa22',
  pubKey_1H_0: '02e3a4d6d1d2043e4643c1505a7dfd30c27d2b34863e7dbaacd50f896dfb16dd86'
}, {
  id: '551984256819ededc0ee851f99546fc1856d20f883960c868917626091128d30',
  xPrivKey: 'xprv9s21ZrQH143K27WsnsbtSync63dMn5ADYT7yf8ARMGtG5CyhAxhcNfjrx9yYUYTApZUfkLqvgYzeLwB5K56pfWkLxvy8wSK4Bog5o8XUKJ6',
  xPubKey: 'xpub661MyMwAqRbcEbbLtu8tp7jLe5TrBXt4ug3aTWa2ucREx1JqiW1rvU4LoSwm4B1DoXhkGSTRSKpSUYQVENP9AYX3EHAP4oyeGtGBeKJ7hwd',
  xPrivKey_45H: 'xprv9vdUpVGJA9iQf5GDq7eR34N75DjytYj5adyggnqdA9fCCfgofiQEELA7o4UiNQ2zf3xjHyeNDhQhib7RQjTeYnapWxu1eSQdCrExzb9J8v7',
  xPubKey_45H: 'xpub69cqDzoBzXGhsZLgw9BRQCJqdFaUJ1SvwruHVBFEiVCB5U1xDFiUn8UbeKmXemb5ENTgJhoxYKe4yQazwsXFScehhMrc5vAXUVK1mQfyVST',
  xPrivKey_1H: 'xprv9vdUpVGJA9iNgurZGgm6HhVHF7GQbcpWbezkQcCnwCdz5Tigip2AyEtg2Jz98e7Mthm6yEK72CzNagyMyCGQNuYhErB1Er1ykTpBKeTjsan',
  xPubKey_1H: 'xpub69cqDzoBzXGfuPw2NiJ6eqS1o96u15YMxsvMCzcQVYAxxG3qGMLRX3D9sZxY3V2CLNX5rZZYB4QUg5zLb961c7CPD46fM9M4rVatc65qeF6',
  privKey_1H_0: 'c8e4cd009e0ed12564eb96b2ffc68181716748ec9a7f6b218b08587337438bba',
  pubKey_1H_0: '032137a03bc2cbba134fc3a1529358b56ca0764f699f6e3cc74118044f9bfad33b'
}, {
  id: '364783ba3fa7f82a188ad665ddee376a0abe930194b1dfc148199b54205b992b',
  xPrivKey: 'xprv9s21ZrQH143K2scQXETcb8fMvaao2ApiBWsuYiLz1GLr3T5UWi8bmEvpVWvTGEYjcMEnHEET4RrouGhYo3qBX4yuLXJ9q6viSFykJcGmNXn',
  xPubKey: 'xpub661MyMwAqRbcFMgsdFzcxGc6UcRHRdYZYjoWM6kbZbspvFQd4FSrK3FJLpwdhqsEL3PYLarn1Av24qDwxfizXkgaKmvLAdJ16MPao2o4MNq',
  xPrivKey_45H: 'xprv9u2Yq2Sc1xugbPWe4LBefYGiRKbytz9vpbZgWdqk1fZKoLSeTFC5Qb6ospfKzbmNai2TCEX1uRtgfaXgnnwUFyGxEUtjwVq8s39kQcv8SxU',
  xPubKey_45H: 'xpub681uEXyVrLTyosb7AMif2gDSyMSUJSsnBpVHK2FMa16Jg8mnznWKxPRHj5kWjpHXiJUutUZqAmy6EpomMGRP5im9U95jq85aMwyS7YcJVim',
  xPrivKey_1H: 'xprv9u2Yq2Sc1xueeYe6GSDWWr7LUJTyjzcf1EjWPLEmT6T12je2PPk8D47h65RFC5i2Xqfj5og2FAJFRSHNaa2dwBtJi4AoBDSqL1NLhyXLyGf',
  xPubKey_1H: 'xpub681uEXyVrLTws2iZNTkWsz452LJU9TLWNTf7BieP1RyyuXyAvw4NkrSAwMmgHcYNTYYwtdMQPLQKXL8JeEzHAfAhYVbA2xqjjkfCnoAd4tC',
  privKey_1H_0: '97456bcde0704e054a63a96c11853ba412ab7c33e2ef9fa8661a66db2ce6a94d',
  pubKey_1H_0: '022edcbe1542c789bb0c39e6fef3cd15823d396e355b05139659a059d08da62e50'
}, {
  id: '23892f5b034019d81397f97570a1ea5b9f2977654269623f42abbdb33fe7c4e0',
  xPrivKey: 'xprv9s21ZrQH143K4bhBXV3MvydmC9WKrJ4pY4w9zTyihwunrPsSim2vb5VDsX7zVzLPLXVTN6y2Gc5y7qpYr8Vdow3v3a14zgccPobib5Q5jik',
  xPubKey: 'xpub661MyMwAqRbcH5medWaNJ7aVkBLpFknfuHrknrPLGHSmjCCbGJMB8sohipo1DSXpR7xcnZfsUooP6k8RVoQQ7Ewtmj7jnLbCQDGcBi9Sr3L',
  xPrivKey_45H: 'xprv9twC9XfPNCFMmqBU3UyVLByyFH9QgmUuwy1gpteoAiLN4rSdG3hcLHjqXSqf36JXwavTFNhawGPYYtZUch6qJNoXfZ2XAeyeeWwrnnGdpD7',
  xPubKey_45H: 'xpub67vYZ3CHCZoezKFw9WWVhKvhoJyu6ECmKBwHdH4Qj3sLwemmob1rt64KNkQVNrFhy85WAcokstPsA3JPz6qTHqumg98Lzo6ccL7wKCL3sDt',
  xPrivKey_1H: 'xprv9twC9XfPNCFKozsRsSNChbiQJpRBkjVZoL4McXGyWQRD3dkkazNW7LhFP85DeM5DKw6AgfJPX7F2VggCznFqbsbUXUdwd7QEpTRYb8Agas3',
  xPubKey_1H: 'xpub67vYZ3CHCZod2UwtyTuD4jf8rrFgACDRAYyxQugb4jxBvS5u8Xgkf91jESCqi5jydqLYeATXbk58bM6vfa3kviLHuyFKMVM1KSWB1uWRBdB',
  privKey_1H_0: '5f0011757ae447218cc11b0845b87b7ac9742c8dc37de8d10d590fb096005430',
  pubKey_1H_0: '027e8c73e3c176c7fe992de80fa891a5b73f82151f11b1f9e97ce7b902b20f81b6'
}, {
  id: '5f69e118def0b38ee88c8d47c7254136d081221bfd2c6c3d9d4e7890bc60c22b',
  xPrivKey: 'xprv9s21ZrQH143K3bFvCtYiQZr9seRAjj5sBH3NsvF2mut5NtuSL6CVWhYiKjsdDCXLgxwYB3GUsXqpSfmkjSEoghASHxvS4fNPwbkwk3cn1DM',
  xPubKey: 'xpub661MyMwAqRbcG5LPJv5imhntRgFf9BoiYVxygJeeLFR4FhEasdWk4VsCB3EEw6meT2hGYTE2dN6x1597ekpFJp5wtqoNo25QFe8LBGZatsN',
  xPrivKey_45H: 'xprv9ugBxZE4n42UY137XuYcWPEf1WrtN7Gyj7LEpDyQXwhPQ6iHtXe9LuBXyMyPgFABe9sagz3KKfTXGsJJnDycv3bZv2vZLibnLZyCX5ug5PT',
  xPubKey_45H: 'xpub68fYN4kxcRamkV7adw5csXBPZYhNmZzq6LFqccP26HENGu3SS4xPthW1pdKoSrb4KVonrxpE1pPvi3CjzmB1X19xpmE2dSJwdBLw98Au1EA',
  xPrivKey_1H: 'xprv9ugBxZE4n42Sb78sFa42f8K3mSCm5buKAXTz4Yo7oJvfRFtuy5AtedbsdGMtFULvesJ7KjJtuq8iUv3gxksYFohBHf8jEBihrx4ZkFqLivb',
  xPubKey_1H: 'xpub68fYN4kxcRajobDLMbb32GFnKU3FV4dAXkParwCjMeTeJ4E4WcV9CRvMUX3t7dUu381jjAir4hB588mN4mFkWCVtoDSH8RhEPCzXJtvzHZG',
  privKey_1H_0: '084f923954681d1bfc6622ff69fe225c89561f3f8976832acb436c6b0dc6dd01',
  pubKey_1H_0: '029f7003e5e0a3c53db12439b4b7862c471d4e2fd56879497022cc420ce7a13fee'
}, {
  id: 'ebd86096bf0f7902e293f9d399361204ba5a4bf484c4a7bf3e29f8891f96dca2',
  xPrivKey: 'xprv9s21ZrQH143K2JQLtqcR7QgEXwhwhLWS63pAsEgmRqPu4x9d1oPcv14qTSbV19LWzFTfMbJ2nieS7oCrBxgSKF5hmqFeBCYwFh2kSV8pFRy',
  xPubKey: 'xpub661MyMwAqRbcEnUozs9RUYcy5yYS6oEHTGjmfd6NzAvswkUmZLhsToPKJj4moN2BSSonQDTL9qFYtGsqoRAEwHcxrkwqBfkPBncm23QqrAg',
  xPrivKey_45H: 'xprv9uj2TGqrHjzvdEQrYby5oGHPT96YBzSNUPHe82g9j6xqcJhx19KhWoPu6RxE4EisvuUTjBAwmsTnxYyT9EuSQJvyrWntQkiQ3QSjLx3XSRZ',
  xPubKey_45H: 'xpub68iNrnNk87ZDqiVKedW6AQE81Aw2bTADqcDEvR5mHSVpV736Ygdx4biNwiSFYNFzTY6UziVFffDc92iL6WmANV16SexCX8WfGcDcRvaPJfh',
  xPrivKey_1H: 'xprv9uj2TGqrHjztgbraNVLwq38Smz8Mi1MQE6yN3MXQSj4DaqkyfF1Td8cxpiH4Pd88X6K8qcveM7zpGxFwmi5hB8sQGn3Xnjesojznikr6n9e',
  xPubKey_1H: 'xpub68iNrnNk87ZBu5w3UWsxCB5BL1xr7U5FbKtxqjw214bCTe68CnKiAvwSfzRQkT4hp27XRHRAewgYiV6uVKGgyoiFnKQaVpDWgiexFf5f4zD',
  privKey_1H_0: '8c0552de8b785bf395794e88fbe6e0b87e74dbb49282e00acd98f44064913c41',
  pubKey_1H_0: '034433ac6358faebed43ae5e48061b6796a7ec4523fad547e13d16433140557831'
}, ];

var history = [{
  txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
  vin: [{
    txid: "c8e221141e8bb60977896561b77fa59d6dacfcc10db82bf6f5f923048b11c70d",
    vout: 0,
    n: 0,
    addr: "2N6Zutg26LEC4iYVxi7SHhopVLP1iZPU1rZ",
    valueSat: 485645,
    value: 0.00485645,
  }, {
    txid: "6e599eea3e2898b91087eb87e041c5d8dec5362447a8efba185ed593f6dc64c0",
    vout: 1,
    n: 1,
    addr: "2MyqmcWjmVxW8i39wdk1CVPdEqKyFSY9H1S",
    valueSat: 885590,
    value: 0.0088559,
  }],
  vout: [{
    value: "0.00045753",
    n: 0,
    scriptPubKey: {
      addresses: [
        "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V"
      ]
    },
  }, {
    value: "0.01300000",
    n: 1,
    scriptPubKey: {
      addresses: [
        "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
      ]
    }
  }],
  confirmations: 2,
  firstSeenTs: 1424471041,
  blocktime: 1424471041,
  valueOut: 0.01345753,
  valueIn: 0.01371235,
  fees: 0.00025482
}, {
  txid: "fad88682ccd2ff34cac6f7355fe9ecd8addd9ef167e3788455972010e0d9d0de",
  vin: [{
    txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
    vout: 0,
    n: 0,
    addr: "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V",
    valueSat: 45753,
    value: 0.00045753,
  }],
  vout: [{
    value: "0.00011454",
    n: 0,
    scriptPubKey: {
      addresses: [
        "2N7GT7XaN637eBFMmeczton2aZz5rfRdZso"
      ]
    }
  }, {
    value: "0.00020000",
    n: 1,
    scriptPubKey: {
      addresses: [
        "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
      ]
    }
  }],
  confirmations: 1,
  time: 1424472242,
  blocktime: 1424472242,
  valueOut: 0.00031454,
  valueIn: 0.00045753,
  fees: 0.00014299
}];

module.exports.keyPair = keyPair;
module.exports.message = message;
module.exports.copayers = copayers;
module.exports.history = history;
