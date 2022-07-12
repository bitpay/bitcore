import {Tile, TileDescription} from '../assets/styles/tile';
import React from 'react';

export const SharedTile = ({
  title,
  description,
}: {
  title: string;
  description: string | number | undefined;
}): JSX.Element => (
  <Tile withBorderBottom>
    <TileDescription margin='0 1rem 0 0'>{title}</TileDescription>
    {description ? (
      <TileDescription value textAlign='right'>
        {description}
      </TileDescription>
    ) : null}
  </Tile>
);
