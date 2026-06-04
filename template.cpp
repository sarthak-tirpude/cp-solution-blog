#include <algorithm>
#include <array>
#include <bitset>
#include <cassert>
#include <cctype>
#include <cmath>
#include <deque>
#include <functional>
#include <iostream>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
using namespace std;

using ll = long long;
using pii = pair<int, int>;
using pll = pair<ll, ll>;
#define endl "\n"
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()

[[maybe_unused]] const int INF = 1000000000;
[[maybe_unused]] const ll LINF = 4000000000000000000LL;


namespace dbg {
string trim(string s) {
    size_t l = 0, r = s.size();
    while (l < r && isspace((unsigned char)s[l])) ++l;
    while (r > l && isspace((unsigned char)s[r - 1])) --r;
    return s.substr(l, r - l);
}

vector<string> split_names(const string& s) {
    vector<string> names;
    string cur;
    int depth = 0;
    char quote = 0;

    for (char ch : s) {
        if (quote) {
            cur += ch;
            if (ch == quote) quote = 0;
            continue;
        }

        if (ch == '\'' || ch == '"') {
            quote = ch;
            cur += ch;
            continue;
        }

        if (ch == '(' || ch == '[' || ch == '{' || ch == '<') ++depth;
        if (ch == ')' || ch == ']' || ch == '}' || ch == '>') --depth;

        if (ch == ',' && depth == 0) {
            names.push_back(trim(cur));
            cur.clear();
        } else {
            cur += ch;
        }
    }

    names.push_back(trim(cur));
    return names;
}

template <class T, class = void>
struct is_iterable : false_type {};

template <class T>
struct is_iterable<T, void_t<decltype(begin(declval<T>())), decltype(end(declval<T>()))>> : true_type {};

template <class T>
struct is_string : false_type {};

template <>
struct is_string<string> : true_type {};

template <class T, class = void>
struct is_map_like : false_type {};

template <class T>
struct is_map_like<T, void_t<typename T::key_type, typename T::mapped_type>> : true_type {};

template <class T>
void print_value(const T& value);

template <class A, class B>
void print_value(const pair<A, B>& value) {
    cout << '(';
    print_value(value.first);
    cout << ", ";
    print_value(value.second);
    cout << ')';
}

template <class T>
void print_container(const T& value, char open, char close) {
    cout << open;
    bool first = true;
    for (const auto& item : value) {
        if (!first) cout << ", ";
        first = false;
        print_value(item);
    }
    cout << close;
}

template <class T>
void print_map(const T& value) {
    cout << '{';
    bool first = true;
    for (const auto& [key, mapped] : value) {
        if (!first) cout << ", ";
        first = false;
        print_value(key);
        cout << ": ";
        print_value(mapped);
    }
    cout << '}';
}

template <class T>
void print_value(const T& value) {
    if constexpr (is_same_v<decay_t<T>, char>) {
        cout << '\'' << value << '\'';
    } else if constexpr (is_same_v<decay_t<T>, const char*> || is_same_v<decay_t<T>, char*>) {
        cout << '"' << value << '"';
    } else if constexpr (is_string<decay_t<T>>::value) {
        cout << '"' << value << '"';
    } else if constexpr (is_map_like<decay_t<T>>::value) {
        print_map(value);
    } else if constexpr (is_iterable<decay_t<T>>::value && !is_string<decay_t<T>>::value) {
        print_container(value, '[', ']');
    } else {
        cout << value;
    }
}

template <class... Args>
void print_debug(const char* func, int line, const char* raw_names, const Args&... args) {
    vector<string> names = split_names(raw_names);
    cout << "[debug " << func << ':' << line << "] ";

    int idx = 0;
    ((cout << (idx ? " | " : "")
           << (idx < (int)names.size() ? names[idx] : "?") << " = ",
      print_value(args),
      ++idx), ...);

    cout << '\n';
}
}

#ifdef LOCAL
#define debug(...) ::dbg::print_debug(__func__, __LINE__, #__VA_ARGS__, __VA_ARGS__)
#define dbeug(...) debug(__VA_ARGS__)
#else
#define debug(...) ((void)0)
#define dbeug(...) ((void)0)
#endif


void solve() {
    int n;
    cin >> n;

    vector<ll> a(n + 1);
    for(int i = 1; i <= n; i++) cin >> a[i];

    vector<ll> neg(n + 1, 0);
    for(int i = 1; i <= n; i++) {
        neg[i] = neg[i - 1];
        if(a[i] < 0) neg[i] += -a[i];
    }

    ll base = 0;
    for(int i = 1; i <= n; i++) {
        base += a[i] * i * (n - i + 1);
    }

    vector<ll> c(n + 1), prefC(n + 1);
    for(int l = 1; l <= n; l++) {
        c[l] = neg[l - 1];
        prefC[l] = prefC[l - 1] + c[l];
    }

    const ll NEG = -(1LL << 60);
    vector<ll> b(n + 1, NEG);

    for(int i = 1; i <= n; i++) {
        if(a[i] > 0) b[i] = neg[i - 1] - a[i];
    }

    vector<int> prv(n + 1), nxt(n + 1), st;

    for(int i = 1; i <= n; i++) {
        while(!st.empty() && b[st.back()] < b[i]) st.pop_back();
        prv[i] = st.empty() ? 0 : st.back();
        st.push_back(i);
    }

    st.clear();

    for(int i = n; i >= 1; i--) {
        while(!st.empty() && b[st.back()] <= b[i]) st.pop_back();
        nxt[i] = st.empty() ? n + 1 : st.back();
        st.push_back(i);
    }

    ll extra = 0;

    for(int i = 1; i <= n; i++) {
        if(a[i] <= 0) continue;

        int l = prv[i] + 1;
        int r = i;

        int p = lower_bound(c.begin() + l, c.begin() + r + 1, b[i]) - c.begin() - 1;
        int cnt = p - l + 1;

        if(cnt > 0) {
            ll sumC = prefC[p] - prefC[l - 1];
            ll leftWays = b[i] * cnt - sumC;
            ll rightWays = nxt[i] - i;

            extra += leftWays * rightWays;
        }
    }

    cout << base + 2 * extra << '\n';
}
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int tc = 1;
    cin >> tc;
    while (tc--) solve();

    return 0;
}
