# Encoding

The `bitcore.Encoding` namespace contains utilities for encoding information in common formats in the bitcoin ecosystem.

## Base58 & Base58Check

Two classes are provided: `Base58` and `Base58Check`. The first one merely encodes/decodes a set of bytes in base58 format. The second one will also take the double `sha256` hash of the information and append the last 4 bytes of the hash as a checksum when encoding, and check this checksum when decoding.

## BufferReader & BufferWriter

These classes are used internally to write information in buffers.
