// ONSCREENKM — کتابخانه‌ی حافظه‌ی بومی (اختیاری)
//
// لینوکس/مک:  g++ -O3 -shared -fPIC -o libkm_core.so km_core.cpp
// ویندوز:      cl /LD /O2 km_core.cpp /Fekm_core.dll

#include <cmath>
#include <cstring>
#include <string>
#include <vector>

#if defined(_WIN32)
#define KM_API extern "C" __declspec(dllexport)
#else
#define KM_API extern "C" __attribute__((visibility("default")))
#endif

static const int KM_DIM = 256;

struct Memory {
    std::string text;
    std::vector<float> vec;
};

static std::vector<Memory> g_memories;

static void embed(const char* text, float* out) {
    std::memset(out, 0, sizeof(float) * KM_DIM);
    if (!text) return;

    unsigned long long hash = 1469598103934665603ULL;
    const char* p = text;
    int token = 0;

    while (*p) {
        unsigned char ch = static_cast<unsigned char>(*p++);
        if (ch == ' ' || ch == '\n' || ch == '\t') {
            if (token > 0) {
                out[hash % KM_DIM] += 1.0f;
                hash = 1469598103934665603ULL;
                token = 0;
            }
            continue;
        }
        hash ^= ch;
        hash *= 1099511628211ULL;
        token++;
    }
    if (token > 0) out[hash % KM_DIM] += 1.0f;

    float norm = 0.0f;
    for (int i = 0; i < KM_DIM; i++) norm += out[i] * out[i];
    norm = std::sqrt(norm);
    if (norm > 0.0f) for (int i = 0; i < KM_DIM; i++) out[i] /= norm;
}

KM_API void km_embed(const char* text, float* out) { embed(text, out); }

KM_API float km_cosine(const float* a, const float* b) {
    float dot = 0.0f;
    for (int i = 0; i < KM_DIM; i++) dot += a[i] * b[i];
    return dot;
}

KM_API int km_remember(const char* text) {
    if (!text) return -1;
    Memory m;
    m.text = text;
    m.vec.resize(KM_DIM);
    embed(text, m.vec.data());
    g_memories.push_back(m);
    return static_cast<int>(g_memories.size()) - 1;
}

KM_API float km_recall(const char* query, char* buffer, int bufferSize) {
    if (buffer && bufferSize > 0) buffer[0] = '\0';
    if (!query || g_memories.empty()) return 0.0f;

    std::vector<float> q(KM_DIM);
    embed(query, q.data());

    float best = -1.0f;
    const Memory* hit = nullptr;
    for (const Memory& m : g_memories) {
        float score = km_cosine(q.data(), m.vec.data());
        if (score > best) { best = score; hit = &m; }
    }

    if (hit && buffer && bufferSize > 1) {
        std::strncpy(buffer, hit->text.c_str(), bufferSize - 1);
        buffer[bufferSize - 1] = '\0';
    }
    return best < 0.0f ? 0.0f : best;
}

KM_API int km_memory_count() { return static_cast<int>(g_memories.size()); }

KM_API void km_reset() { g_memories.clear(); }
