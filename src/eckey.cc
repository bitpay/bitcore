
#include <string.h>

#include <v8.h>

#include <node.h>
#include <node_buffer.h>
#include <node_internals.h>

#include <openssl/ecdsa.h>
#include <openssl/evp.h>

#include <iostream>

#include "common.h"
#include "eckey.h"

using namespace std;
using namespace v8;
using namespace node;

int static inline EC_KEY_regenerate_key(EC_KEY *eckey, const BIGNUM *priv_key)
{
  int ok = 0;
  BN_CTX *ctx = NULL;
  EC_POINT *pub_key = NULL;

  if (!eckey) return 0;

  const EC_GROUP *group = EC_KEY_get0_group(eckey);

  if ((ctx = BN_CTX_new()) == NULL)
    goto err;

  pub_key = EC_POINT_new(group);

  if (pub_key == NULL)
    goto err;

  if (!EC_POINT_mul(group, pub_key, priv_key, NULL, NULL, ctx))
    goto err;

  EC_KEY_set_private_key(eckey,priv_key);
  EC_KEY_set_public_key(eckey,pub_key);

  ok = 1;

 err:

  if (pub_key)
    EC_POINT_free(pub_key);
  if (ctx != NULL)
    BN_CTX_free(ctx);

  return(ok);
}

namespace bitcoin {

void Key::Generate()
{
  if (!EC_KEY_generate_key(ec)) {
    lastError = "Error from EC_KEY_generate_key";
    return;
  }

  hasPublic = true;
  hasPrivate = true;
}

int Key::VerifySignature(const unsigned char *digest, int digest_len,
                    const unsigned char *sig, int sig_len)
{
  return ECDSA_verify(0, digest, digest_len, sig, sig_len, ec);
}

void Key::EIO_VerifySignature(uv_work_t *req)
{
  verify_sig_baton_t *b = static_cast<verify_sig_baton_t *>(req->data);

  b->result = b->key->VerifySignature(
    b->digest, b->digestLen,
    b->sig, b->sigLen
  );
}

ECDSA_SIG *Key::Sign(const unsigned char *digest, int digest_len)
{
  ECDSA_SIG *sig;

  sig = ECDSA_do_sign(digest, digest_len, ec);
  if (sig == NULL) {
    // TODO: ERROR
  }

  return sig;
}

void Key::Init(Handle<Object> target)
{
  HandleScope scope;
  Local<FunctionTemplate> t = FunctionTemplate::New(New);

  s_ct = Persistent<FunctionTemplate>::New(t);
  s_ct->InstanceTemplate()->SetInternalFieldCount(1);
  s_ct->SetClassName(String::NewSymbol("Key"));

  // Accessors
  s_ct->InstanceTemplate()->SetAccessor(String::New("private"),
                                        GetPrivate, SetPrivate);
  s_ct->InstanceTemplate()->SetAccessor(String::New("public"),
                                        GetPublic, SetPublic);
  s_ct->InstanceTemplate()->SetAccessor(String::New("compressed"),
                                        GetCompressed, SetCompressed);

  // Methods
  NODE_SET_PROTOTYPE_METHOD(s_ct, "verifySignature", VerifySignature);
  NODE_SET_PROTOTYPE_METHOD(s_ct, "verifySignatureSync", VerifySignatureSync);
  NODE_SET_PROTOTYPE_METHOD(s_ct, "regenerateSync", RegenerateSync);
  NODE_SET_PROTOTYPE_METHOD(s_ct, "toDER", ToDER);
  NODE_SET_PROTOTYPE_METHOD(s_ct, "signSync", SignSync);

  // Static methods
  NODE_SET_METHOD(s_ct->GetFunction(), "generateSync", GenerateSync);
  NODE_SET_METHOD(s_ct->GetFunction(), "fromDER", FromDER);
  NODE_SET_METHOD(s_ct->GetFunction(), "addUncompressed", AddUncompressed);
  NODE_SET_METHOD(s_ct->GetFunction(), "multiplyUncompressed", MultiplyUncompressed);

  target->Set(String::NewSymbol("Key"),
              s_ct->GetFunction());
}

Key::Key() :
  lastError(NULL),
  isCompressed(true),
  hasPrivate(false),
  hasPublic(false)
{
  ec = EC_KEY_new_by_curve_name(NID_secp256k1);
  if (ec == NULL) {
    lastError = "Error from EC_KEY_new_by_curve_name";
  }
}

Key::~Key()
{
  EC_KEY_free(ec);
}

Key*
Key::New()
{
  HandleScope scope;

  Local<Object> k = s_ct->GetFunction()->NewInstance(0, NULL);
  if (k.IsEmpty()) return NULL;

  return ObjectWrap::Unwrap<Key>(k);
}

Handle<Value>
Key::New(const Arguments& args)
{
  HandleScope scope;

  // this was invoked as Key() not new Key()
  if (!args.IsConstructCall()) {
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    return scope.Close(s_ct->GetFunction()->NewInstance(argc, argv));
  }
  else{
    Key* key = new Key();
    if (key->lastError != NULL) {
      return VException(key->lastError);
    }

    key->Wrap(args.Holder());

    return scope.Close(args.This());
  }
}

Handle<Value>
Key::GenerateSync(const Arguments& args)
{
  HandleScope scope;

  Key* key = Key::New();

  key->Generate();

  if (key->lastError != NULL) {
    return VException(key->lastError);
  }

  return scope.Close(key->handle_);
}

Handle<Value>
Key::GetPrivate(Local<String> property, const AccessorInfo& info)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());

  if (!key->hasPrivate) {
    return scope.Close(Null());
  }

  const BIGNUM *bn = EC_KEY_get0_private_key(key->ec);
  int priv_size = BN_num_bytes(bn);

  if (bn == NULL) {
    // TODO: ERROR: "Error from EC_KEY_get0_private_key(pkey)"
    return scope.Close(Null());
  }

  if (priv_size > 32) {
    // TODO: ERROR: "Secret too large (Incorrect curve parameters?)"
    return scope.Close(Null());
  }

  unsigned char *priv = (unsigned char *)calloc(32, 1);

  int n = BN_bn2bin(bn, &priv[32 - priv_size]);

  if (n != priv_size) {
    // TODO: ERROR: "Error from BN_bn2bin(bn, &priv[32 - priv_size])"
    return scope.Close(Null());
  }

  Buffer *priv_buf = Buffer::New(32);
  memcpy(Buffer::Data(priv_buf), priv, 32);

  free(priv);

  return scope.Close(priv_buf->handle_);
}

void
Key::SetPrivate(Local<String> property, Local<Value> value, const AccessorInfo& info)
{
  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());
  Handle<Object> buffer = value->ToObject();
  const unsigned char *data = (const unsigned char*) Buffer::Data(buffer);

  BIGNUM *bn = BN_bin2bn(data,Buffer::Length(buffer),BN_new());
  EC_KEY_set_private_key(key->ec, bn);
  BN_clear_free(bn);

  key->hasPrivate = true;
}

void
Key::SetCompressed(Local<String> property, Local<Value> value, const AccessorInfo& info)
{
  if (!value->IsBoolean()) {
    ThrowException(Exception::Error(String::New("compressed must be boolean")));
    return;
  }

  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());

  key->isCompressed = value->BooleanValue();
}

Handle<Value>
Key::GetCompressed(Local<String> property, const AccessorInfo& info)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());

  return scope.Close(Boolean::New(key->isCompressed));
}

Handle<Value>
Key::GetPublic(Local<String> property, const AccessorInfo& info)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());

  if (!key->hasPublic) {
    return scope.Close(Null());
  }

  // Set compressed/uncompressed (we prefer compressed)
  EC_KEY_set_conv_form(key->ec, key->isCompressed ?
  	POINT_CONVERSION_COMPRESSED : POINT_CONVERSION_UNCOMPRESSED);

  // Export public
  int pub_size = i2o_ECPublicKey(key->ec, NULL);
  if (!pub_size) {
    // TODO: ERROR: "Error from i2o_ECPublicKey(key->ec, NULL)"
    return VException("Error from i2o_ECPublicKey(key->ec, NULL)");
  }
  unsigned char *pub_begin, *pub_end;
  pub_begin = pub_end = (unsigned char *)malloc(pub_size);

  if (i2o_ECPublicKey(key->ec, &pub_end) != pub_size) {
    // TODO: ERROR: "Error from i2o_ECPublicKey(key->ec, &pub)"
    return VException("Error from i2o_ECPublicKey(key->ec, &pub)");
  }
  Buffer *pub_buf = Buffer::New(pub_size);
  memcpy(Buffer::Data(pub_buf), pub_begin, pub_size);

  free(pub_begin);

  return scope.Close(pub_buf->handle_);
}

void
Key::SetPublic(Local<String> property, Local<Value> value, const AccessorInfo& info)
{
  Key* key = node::ObjectWrap::Unwrap<Key>(info.Holder());
  Handle<Object> buffer = value->ToObject();
  const unsigned char *data = (const unsigned char*) Buffer::Data(buffer);
  ec_key_st* ret = o2i_ECPublicKey(&(key->ec), &data, Buffer::Length(buffer));

  if (!ret) {
    // TODO: Error
    VException("Invalid public key.");
    return;
  }

  key->hasPublic = true;
}

Handle<Value>
Key::RegenerateSync(const Arguments& args)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(args.This());

  if (!key->hasPrivate) {
    return VException("Regeneration requires a private key.");
  }

  EC_KEY *old = key->ec;

  key->ec = EC_KEY_new_by_curve_name(NID_secp256k1);
  if (EC_KEY_regenerate_key(key->ec, EC_KEY_get0_private_key(old)) == 1) {
    key->hasPublic = true;
  }

  EC_KEY_free(old);

  return scope.Close(Undefined());
}

Handle<Value>
Key::ToDER(const Arguments& args)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(args.This());

  if (!key->hasPrivate || !key->hasPublic) {
    return scope.Close(Null());
  }

  // Export DER
  int der_size = i2d_ECPrivateKey(key->ec, NULL);
  if (!der_size) {
    // TODO: ERROR: "Error from i2d_ECPrivateKey(key->ec, NULL)"
    return scope.Close(Null());
  }
  unsigned char *der_begin, *der_end;
  der_begin = der_end = (unsigned char *)malloc(der_size);

  if (i2d_ECPrivateKey(key->ec, &der_end) != der_size) {
    // TODO: ERROR: "Error from i2d_ECPrivateKey(key->ec, &der_end)"
    return scope.Close(Null());
  }
  Buffer *der_buf = Buffer::New(der_size);
  memcpy(Buffer::Data(der_buf), der_begin, der_size);

  free(der_begin);

  return scope.Close(der_buf->handle_);
}

Handle<Value>
Key::FromDER(const Arguments& args)
{
  HandleScope scope;

  if (args.Length() != 1) {
    return VException("One argument expected: der");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'der' must be of type Buffer");
  }

  Key* key = new Key();
  if (key->lastError != NULL) {
    return VException(key->lastError);
  }

  Handle<Object> der_buf = args[0]->ToObject();
  const unsigned char *data = (const unsigned char*) Buffer::Data(der_buf);

  if (!d2i_ECPrivateKey(&(key->ec), &data, Buffer::Length(der_buf))) {
    return VException("Error from d2i_ECPrivateKey(&key, &data, len)");
  }

  key->hasPrivate = true;
  key->hasPublic = true;

  Handle<Function> cons = s_ct->GetFunction();
  Handle<Value> external = External::New(key);
  Handle<Value> result = cons->NewInstance(1, &external);

  return scope.Close(result);
}

Handle<Value>
Key::AddUncompressed(const Arguments& args)
{
  HandleScope scope;

  if (args.Length() != 2) {
    return VException("Two arguments expected: point0, point1");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'point0' must be of type Buffer");
  }
  if (Buffer::Length(args[0]) != 65) {
    return VException("Argument 'point0' must have length 65");
  }
  if (!Buffer::HasInstance(args[1])) {
    return VException("Argument 'point1' must be of type Buffer");
  }
  if (Buffer::Length(args[1]) != 65) {
    return VException("Argument 'point1' must have length 65");
  }

  Handle<Object> point0_buf = args[0]->ToObject();
  unsigned char *point0 = (unsigned char*) Buffer::Data(point0_buf);

  Handle<Object> point1_buf = args[1]->ToObject();
  unsigned char *point1 = (unsigned char*) Buffer::Data(point1_buf);

  EC_KEY *eckey = EC_KEY_new_by_curve_name(NID_secp256k1);
  const EC_GROUP *group = EC_KEY_get0_group(eckey);

  BN_CTX *ctx;
  EC_POINT *p0, *p1, *r;
  BIGNUM *p0x, *p0y, *p1x, *p1y, *rx, *ry;
  Buffer *rbuf;

  p0 = EC_POINT_new(group);
  p1 = EC_POINT_new(group);
  r = EC_POINT_new(group);

  p0x = BN_bin2bn(&point0[1], 32, BN_new());
  p0y = BN_bin2bn(&point0[33], 32, BN_new());
  p1x = BN_bin2bn(&point1[1], 32, BN_new());
  p1y = BN_bin2bn(&point1[33], 32, BN_new());

  ctx = BN_CTX_new();

  EC_POINT_set_affine_coordinates_GFp(group, p0, p0x, p0y, ctx);
  EC_POINT_set_affine_coordinates_GFp(group, p1, p1x, p1y, ctx);

  EC_POINT_add(group, r, p0, p1, ctx);

  rx = BN_new();
  ry = BN_new();
  EC_POINT_get_affine_coordinates_GFp(group, r, rx, ry, ctx);
  
  rbuf = Buffer::New(65);
  EC_POINT_point2oct(group, r, POINT_CONVERSION_UNCOMPRESSED, (unsigned char *)Buffer::Data(rbuf), 65, ctx);

  //free: eckey, p0, p1, r, p0x, p0y, p1x, p1y, ctx, rx, ry, /*rbuf,*/ rcx, rcy
  BN_clear_free(ry);
  BN_clear_free(rx);
  //do not free rbuf - this is returned
  BN_CTX_free(ctx);
  BN_clear_free(p0x);
  BN_clear_free(p0y);
  BN_clear_free(p1x);
  BN_clear_free(p1y);
  EC_POINT_free(r);
  EC_POINT_free(p1);
  EC_POINT_free(p0);
  EC_KEY_free(eckey);

  return scope.Close(rbuf->handle_);
}

Handle<Value>
Key::MultiplyUncompressed(const Arguments& args)
{
  HandleScope scope;

  if (args.Length() != 2) {
    return VException("Two arguments expected: point0, x");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'point0' must be of type Buffer");
  }
  if (Buffer::Length(args[0]) != 65) {
    return VException("Argument 'point0' must have length 65");
  }
  if (!Buffer::HasInstance(args[1])) {
    return VException("Argument 'x' must be of type Buffer");
  }
  if (Buffer::Length(args[1]) != 32) {
    return VException("Argument 'x' must have length 32");
  }

  Handle<Object> point0_buf = args[0]->ToObject();
  unsigned char *point0 = (unsigned char*) Buffer::Data(point0_buf);

  Handle<Object> x_buf = args[1]->ToObject();
  unsigned char *xval = (unsigned char*) Buffer::Data(x_buf);

  EC_KEY *eckey = EC_KEY_new_by_curve_name(NID_secp256k1);
  const EC_GROUP *group = EC_KEY_get0_group(eckey);

  BN_CTX *ctx;
  EC_POINT *p0, *r;
  BIGNUM *p0x, *p0y, *x, *rx, *ry;
  Buffer *rbuf;

  p0 = EC_POINT_new(group);
  r = EC_POINT_new(group);

  p0x = BN_bin2bn(&point0[1], 32, BN_new());
  p0y = BN_bin2bn(&point0[33], 32, BN_new());
  x = BN_bin2bn(&xval[0], 32, BN_new());

  ctx = BN_CTX_new();

  EC_POINT_set_affine_coordinates_GFp(group, p0, p0x, p0y, ctx);

  EC_POINT_mul(group, r, NULL, p0, x, ctx);

  rx = BN_new();
  ry = BN_new();
  EC_POINT_get_affine_coordinates_GFp(group, r, rx, ry, ctx);

  rbuf = Buffer::New(65);
  EC_POINT_point2oct(group, r, POINT_CONVERSION_UNCOMPRESSED, (unsigned char *)Buffer::Data(rbuf), 65, ctx);

  //free: eckey, p0, p1, r, p0x, p0y, p1x, p1y, ctx, rx, ry, /*rbuf,*/ rcx, rcy
  BN_clear_free(ry);
  BN_clear_free(rx);
  //do not free rbuf - this is returned
  BN_CTX_free(ctx);
  BN_clear_free(p0x);
  BN_clear_free(p0y);
  BN_clear_free(x);
  EC_POINT_free(r);
  EC_POINT_free(p0);
  EC_KEY_free(eckey);

  return scope.Close(rbuf->handle_);
}

Handle<Value>
Key::VerifySignature(const Arguments& args)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(args.This());

  if (args.Length() != 3) {
    return VException("Three arguments expected: hash, sig, callback");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'hash' must be of type Buffer");
  }
  if (!Buffer::HasInstance(args[1])) {
    return VException("Argument 'sig' must be of type Buffer");
  }
  REQ_FUN_ARG(2, cb);
  if (!key->hasPublic) {
    return VException("Key does not have a public key set");
  }

  Handle<Object> hash_buf = args[0]->ToObject();
  Handle<Object> sig_buf = args[1]->ToObject();

  if (Buffer::Length(hash_buf) != 32) {
    return VException("Argument 'hash' must be Buffer of length 32 bytes");
  }

  verify_sig_baton_t *baton = new verify_sig_baton_t();
  baton->key = key;
  baton->digest = (unsigned char *)Buffer::Data(hash_buf);
  baton->digestLen = Buffer::Length(hash_buf);
  baton->digestBuf = Persistent<Object>::New(hash_buf);
  baton->sig = (unsigned char *)Buffer::Data(sig_buf);
  baton->sigLen = Buffer::Length(sig_buf);
  baton->sigBuf = Persistent<Object>::New(sig_buf);
  baton->result = -1;
  baton->cb = Persistent<Function>::New(cb);

  key->Ref();

  uv_work_t *req = new uv_work_t;
  req->data = baton;

  uv_queue_work(uv_default_loop(), req, EIO_VerifySignature, VerifySignatureCallback);

  return scope.Close(Undefined());
}

void
Key::VerifySignatureCallback(uv_work_t *req, int status)
{
  HandleScope scope;
  verify_sig_baton_t *baton = static_cast<verify_sig_baton_t *>(req->data);

  baton->key->Unref();
  baton->digestBuf.Dispose();
  baton->sigBuf.Dispose();

  Local<Value> argv[2];

  argv[0] = Local<Value>::New(Null());
  argv[1] = Local<Value>::New(Null());
  if (baton->result == -1) {
    argv[0] = Exception::TypeError(String::New("Error during ECDSA_verify"));
  } else if (baton->result == 0) {
    // Signature invalid
    argv[1] = Local<Value>::New(Boolean::New(false));
  } else if (baton->result == 1) {
    // Signature valid
    argv[1] = Local<Value>::New(Boolean::New(true));
  } else {
    argv[0] = Exception::TypeError(
      String::New("ECDSA_verify gave undefined return value"));
  }

  TryCatch try_catch;

  baton->cb->Call(Context::GetCurrent()->Global(), 2, argv);


  baton->cb.Dispose();

  delete baton;
  delete req;

  if (try_catch.HasCaught()) {
    FatalException(try_catch);
  }
}

Handle<Value>
Key::VerifySignatureSync(const Arguments& args)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(args.This());

  if (args.Length() != 2) {
    return VException("Two arguments expected: hash, sig");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'hash' must be of type Buffer");
  }
  if (!Buffer::HasInstance(args[1])) {
    return VException("Argument 'sig' must be of type Buffer");
  }
  if (!key->hasPublic) {
    return VException("Key does not have a public key set");
  }

  Handle<Object> hash_buf = args[0]->ToObject();
  Handle<Object> sig_buf = args[1]->ToObject();

  const unsigned char *hash_data = (unsigned char *) Buffer::Data(hash_buf);
  const unsigned char *sig_data = (unsigned char *) Buffer::Data(sig_buf);

  unsigned int hash_len = Buffer::Length(hash_buf);
  unsigned int sig_len = Buffer::Length(sig_buf);

  if (hash_len != 32) {
    return VException("Argument 'hash' must be Buffer of length 32 bytes");
  }

  // Verify signature
  int result = key->VerifySignature(hash_data, hash_len, sig_data, sig_len);

  if (result == -1) {
    return VException("Error during ECDSA_verify");
  } else if (result == 0) {
    // Signature invalid
    return scope.Close(Boolean::New(false));
  } else if (result == 1) {
    // Signature valid
    return scope.Close(Boolean::New(true));
  } else {
    return VException("ECDSA_verify gave undefined return value");
  }
}

Handle<Value>
Key::SignSync(const Arguments& args)
{
  HandleScope scope;
  Key* key = node::ObjectWrap::Unwrap<Key>(args.This());

  if (args.Length() != 1) {
    return VException("One argument expected: hash");
  }
  if (!Buffer::HasInstance(args[0])) {
    return VException("Argument 'hash' must be of type Buffer");
  }
  if (!key->hasPrivate) {
    return VException("Key does not have a private key set");
  }

  Handle<Object> hash_buf = args[0]->ToObject();

  const unsigned char *hash_data = (unsigned char *) Buffer::Data(hash_buf);

  unsigned int hash_len = Buffer::Length(hash_buf);

  if (hash_len != 32) {
    return VException("Argument 'hash' must be Buffer of length 32 bytes");
  }

  // Create signature
  ECDSA_SIG *sig = key->Sign(hash_data, hash_len);

  // Export DER
  int der_size = i2d_ECDSA_SIG(sig, NULL);
  if (!der_size) {
    // TODO: ERROR: "Error from i2d_ECPrivateKey(key->ec, NULL)"
    return scope.Close(Null());
  }
  unsigned char *der_begin, *der_end;
  der_begin = der_end = (unsigned char *)malloc(der_size);

  if (i2d_ECDSA_SIG(sig, &der_end) != der_size) {
    // TODO: ERROR: "Error from i2d_ECPrivateKey(key->ec, &der_end)"
    return scope.Close(Null());
  }
  Buffer *der_buf = Buffer::New(der_size);
  memcpy(Buffer::Data(der_buf), der_begin, der_size);

  free(der_begin);
  ECDSA_SIG_free(sig);

  return scope.Close(der_buf->handle_);
}

Persistent<FunctionTemplate> Key::s_ct;

};	// namespace bitcoin

extern "C" void
init (Handle<Object> target)
{
  bitcoin::Key::Init(target);
}

NODE_MODULE(KeyModule, init)
