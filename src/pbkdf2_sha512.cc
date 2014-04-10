// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

#include "node_crypto.h"
#include "node_crypto_groups.h"
#include "v8.h"

#include "node_internals.h"
#include "node.h"
#include "node_buffer.h"
#include "string_bytes.h"
#include "node_root_certs.h"

#include <string.h>
#ifdef _MSC_VER
#define strcasecmp _stricmp
#endif

#include <stdlib.h>
#include <errno.h>

#if OPENSSL_VERSION_NUMBER >= 0x10000000L
# define OPENSSL_CONST const
#else
# define OPENSSL_CONST
#endif

#define ASSERT_IS_STRING_OR_BUFFER(val) \
  if (!Buffer::HasInstance(val) && !val->IsString()) { \
    return ThrowException(Exception::TypeError(String::New( \
            "Not a string or buffer"))); \
  }

#define ASSERT_IS_BUFFER(val) \
  if (!Buffer::HasInstance(val)) { \
    return ThrowException(Exception::TypeError(String::New("Not a buffer"))); \
  }

namespace node {
namespace cryptox {

using namespace v8;

struct pbkdf2_req {
  uv_work_t work_req;
  int err;
  char* pass;
  size_t passlen;
  char* salt;
  size_t saltlen;
  size_t iter;
  char* key;
  size_t keylen;
  Persistent<Object> obj;
};


void EIO_PBKDF2_SHA512(pbkdf2_req* req) {
  req->err = PKCS5_PBKDF2_HMAC(
    req->pass,
    req->passlen,
    (unsigned char*)req->salt,
    req->saltlen,
    req->iter,
    EVP_sha512(),
    req->keylen,
    (unsigned char*)req->key);
  memset(req->pass, 0, req->passlen);
  memset(req->salt, 0, req->saltlen);
}


void EIO_PBKDF2_SHA512(uv_work_t* work_req) {
  pbkdf2_req* req = container_of(work_req, pbkdf2_req, work_req);
  EIO_PBKDF2_SHA512(req);
}


void EIO_PBKDF2After_SHA512(pbkdf2_req* req, Local<Value> argv[2]) {
  if (req->err) {
    argv[0] = Local<Value>::New(Undefined());
    argv[1] = Encode(req->key, req->keylen, BUFFER);
    memset(req->key, 0, req->keylen);
  } else {
    argv[0] = Exception::Error(String::New("PBKDF2 error"));
    argv[1] = Local<Value>::New(Undefined());
  }

  delete[] req->pass;
  delete[] req->salt;
  delete[] req->key;
  delete req;
}


void EIO_PBKDF2After_SHA512(uv_work_t* work_req, int status) {
  assert(status == 0);
  pbkdf2_req* req = container_of(work_req, pbkdf2_req, work_req);
  HandleScope scope;
  Local<Value> argv[2];
  Persistent<Object> obj = req->obj;
  EIO_PBKDF2After_SHA512(req, argv);
  MakeCallback(obj, "ondone", ARRAY_SIZE(argv), argv);
  obj.Dispose();
}


Handle<Value> PBKDF2_SHA512(const Arguments& args) {
  HandleScope scope;

  const char* type_error = NULL;
  char* pass = NULL;
  char* salt = NULL;
  ssize_t passlen = -1;
  ssize_t saltlen = -1;
  ssize_t keylen = -1;
  ssize_t pass_written = -1;
  ssize_t salt_written = -1;
  ssize_t iter = -1;
  pbkdf2_req* req = NULL;

  if (args.Length() != 4 && args.Length() != 5) {
    type_error = "Bad parameter";
    goto err;
  }

  ASSERT_IS_BUFFER(args[0]);
  passlen = Buffer::Length(args[0]);
  if (passlen < 0) {
    type_error = "Bad password";
    goto err;
  }

  pass = new char[passlen];
  pass_written = DecodeWrite(pass, passlen, args[0], BINARY);
  assert(pass_written == passlen);

  ASSERT_IS_BUFFER(args[1]);
  saltlen = Buffer::Length(args[1]);
  if (saltlen < 0) {
    type_error = "Bad salt";
    goto err;
  }

  salt = new char[saltlen];
  salt_written = DecodeWrite(salt, saltlen, args[1], BINARY);
  assert(salt_written == saltlen);

  if (!args[2]->IsNumber()) {
    type_error = "Iterations not a number";
    goto err;
  }

  iter = args[2]->Int32Value();
  if (iter < 0) {
    type_error = "Bad iterations";
    goto err;
  }

  if (!args[3]->IsNumber()) {
    type_error = "Key length not a number";
    goto err;
  }

  keylen = args[3]->Int32Value();
  if (keylen < 0) {
    type_error = "Bad key length";
    goto err;
  }

  req = new pbkdf2_req;
  req->err = 0;
  req->pass = pass;
  req->passlen = passlen;
  req->salt = salt;
  req->saltlen = saltlen;
  req->iter = iter;
  req->key = new char[keylen];
  req->keylen = keylen;

  if (args[4]->IsFunction()) {
    req->obj = Persistent<Object>::New(Object::New());
    req->obj->Set(String::New("ondone"), args[4]);
    uv_queue_work(uv_default_loop(),
                  &req->work_req,
                  EIO_PBKDF2_SHA512,
                  EIO_PBKDF2After_SHA512);
    return Undefined();
  } else {
    Local<Value> argv[2];
    EIO_PBKDF2_SHA512(req);
    EIO_PBKDF2After_SHA512(req, argv);
    if (argv[0]->IsObject()) return ThrowException(argv[0]);
    return scope.Close(argv[1]);
  }

err:
  delete[] salt;
  delete[] pass;
  return ThrowException(Exception::TypeError(String::New(type_error)));
}

void InitCryptox(Handle<Object> target) {
  NODE_SET_METHOD(target, "PBKDF2_sha512", PBKDF2_SHA512);
}

}
}

NODE_MODULE(cryptox, node::cryptox::InitCryptox)

