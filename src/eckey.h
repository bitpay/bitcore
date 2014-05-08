#ifndef LIBCOIN_SERVER_INCLUDE_ECKEY_H_
#define LIBCOIN_SERVER_INCLUDE_ECKEY_H_

#include <v8.h>
#include <node.h>

using namespace v8;
using namespace node;

namespace bitcoin {

class Key : ObjectWrap
{
private:

  const char *lastError;
  EC_KEY *ec;

  bool isCompressed;
  bool hasPrivate;
  bool hasPublic;

  void Generate();

  struct verify_sig_baton_t {
    // Parameters
    Key *key;
    const unsigned char *digest;
    const unsigned char *sig;
    int digestLen;
    int sigLen;
    Persistent<Object> digestBuf;
    Persistent<Object> sigBuf;

    // Result
    // -1 = error, 0 = bad sig, 1 = good
    int result;
    Persistent<Function> cb;
  };

  int VerifySignature(const unsigned char *digest, int digest_len,
                      const unsigned char *sig, int sig_len);

  static void EIO_VerifySignature(uv_work_t *req);

  ECDSA_SIG *Sign(const unsigned char *digest, int digest_len);

public:

  static Persistent<FunctionTemplate> s_ct;

  static void Init(Handle<Object> target);

  Key();
  ~Key();

  static Key* New();

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> GenerateSync(const Arguments& args);

  static Handle<Value>
    GetPrivate(Local<String> property, const AccessorInfo& info);

  static void
    SetPrivate(Local<String> property, Local<Value> value, const AccessorInfo& info);

  static Handle<Value>
    GetPublic(Local<String> property, const AccessorInfo& info);

  static void
    SetPublic(Local<String> property, Local<Value> value, const AccessorInfo& info);

  static Handle<Value>
    GetCompressed(Local<String> property, const AccessorInfo& info);

  static void
    SetCompressed(Local<String> property, Local<Value> value, const AccessorInfo& info);

  static Handle<Value>
    RegenerateSync(const Arguments& args);

  static Handle<Value>
    ToDER(const Arguments& args);

  static Handle<Value>
    FromDER(const Arguments& args);

  static Handle<Value>
    AddUncompressed(const Arguments& args);

  static Handle<Value>
    MultiplyUncompressed(const Arguments& args);

  static Handle<Value>
    VerifySignature(const Arguments& args);

  static void
    VerifySignatureCallback(uv_work_t *req, int status);

  static Handle<Value>
    VerifySignatureSync(const Arguments& args);

  static Handle<Value>
    SignSync(const Arguments& args);
};

};	// namespace bitcoin

#endif
