#include <algorithm>
#include <array>
#include <bitset>
#include <cassert>
#include <cmath>
#include <deque>
#include <iostream>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

using ll = long long;

void solve() {
    ll n, a, b;
    cin >> n >> a >> b;

    ll packs = n / 3;
    ll rem = n % 3;
    ll ans = packs * min(3 * a, b) + min(rem * a, b);

    cout << ans << '\n';
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int tc = 1;
    cin >> tc;
    while (tc--) solve();

    return 0;
}
