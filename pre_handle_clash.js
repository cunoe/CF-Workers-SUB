import yaml from 'js-yaml.min.js';

// Define main function (script entry)
// 国内DNS服务器
const domesticNameservers = [
  "https://dns.alidns.com/dns-query", // 阿里云公共DNS
  "https://doh.pub/dns-query", // 腾讯DNSPod
  "https://doh.360.cn/dns-query", // 360安全DNS
];
// 国外DNS服务器
const foreignNameservers = [
  "https://1.1.1.1/dns-query", // Cloudflare(主)
  "https://1.0.0.1/dns-query", // Cloudflare(备)
  "https://208.67.222.222/dns-query", // OpenDNS(主)
  "https://208.67.220.220/dns-query", // OpenDNS(备)
  "https://194.242.2.2/dns-query", // Mullvad(主)
  "https://194.242.2.3/dns-query", // Mullvad(备)
];
// DNS配置
const dnsConfig = {
  enable: true,
  listen: "0.0.0.0:1053",
  ipv6: true,
  "use-system-hosts": false,
  "cache-algorithm": "arc",
  "enhanced-mode": "fake-ip",
  "fake-ip-range": "198.18.0.1/16",
  "fake-ip-filter": [
    // 本地主机/设备
    "+.lan",
    "+.local",
    // Windows网络出现小地球图标
    "+.msftconnecttest.com",
    "+.msftncsi.com",
    // QQ快速登录检测失败
    "localhost.ptlogin2.qq.com",
    "localhost.sec.qq.com",
    // 微信快速登录检测失败
    "localhost.work.weixin.qq.com",
  ],
  "default-nameserver": ["223.5.5.5", "119.29.29.29", "1.1.1.1", "8.8.8.8"],
  nameserver: [...domesticNameservers, ...foreignNameservers],
  "proxy-server-nameserver": [...domesticNameservers, ...foreignNameservers],
  "nameserver-policy": {
    "geosite:private,cn,geolocation-cn": domesticNameservers,
    "geosite:google,youtube,telegram,gfw,geolocation-!cn": foreignNameservers,
  },
};
function filterHighPriorityProxies(proxies) {
  return proxies.filter((proxy) =>
    proxy.name.toLowerCase().includes("cf|warp")
  );
}
function filterLowPriorityProxies(proxies) {
  return proxies.filter((proxy) => {
    const name = proxy.name.toLowerCase();
    return name.includes("香港") && name.includes("ali");
  });
}
function filterOtherProxies(proxies, highPriority, lowPriority) {
  const excludeNames = [...highPriority, ...lowPriority].map((p) => p.name);
  return proxies.filter((proxy) => !excludeNames.includes(proxy.name));
}
function handler(config, profileName) {
  // 原有的DNS配置保持不变
  config["dns"] = dnsConfig;
  if (!profileName.includes("CUNOE")) {
    return config;
  }
  // 获取不同优先级的节点
  const highPriorityProxies = filterHighPriorityProxies(config.proxies);
  const lowPriorityProxies = filterLowPriorityProxies(config.proxies);
  const otherProxies = filterOtherProxies(
    config.proxies,
    highPriorityProxies,
    lowPriorityProxies
  );
  // 添加新的代理组
  const newProxyGroups = [
    {
      name: "🚀 高优先级节点",
      type: "fallback",
      url: "http://www.gstatic.com/generate_204",
      interval: 60,
      tolerance: 50,
      proxies: [
        highPriorityProxies[
          Math.floor(Math.random() * highPriorityProxies.length)
        ].name,
      ],
    },
    {
      name: "🚀 中优先级节点",
      type: "fallback",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      
      proxies: highPriorityProxies.map((p) => p.name),
    },
    {
      name: "🚀 低优先级节点",
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      proxies: lowPriorityProxies.map((p) => p.name),
    },
    {
      name: "🔄 故障转移",
      type: "fallback",
      url: "http://www.gstatic.com/generate_204",
      interval: 60,
      proxies: [
        "🚀 高优先级节点",
        "🚀 中优先级节点",
        "🚀 低优先级节点",
        "♻️ 自动选择",
        "DIRECT",
      ],
    },
  ];

  // 将新代理组添加到配置中
  config["proxy-groups"] = [...config["proxy-groups"], ...newProxyGroups];
  // 更新节点选择组的代理顺序
  config["proxy-groups"].forEach((group) => {
    if (group.name.includes("节点选择")) {
      group.proxies = [
        "🔄 故障转移",
        "🚀 高优先级节点",
        "🚀 低优先级节点",
        "♻️ 自动选择",
        "DIRECT",
      ];
    } else if (group.name.includes("自动选择")) {
      // 自动选择组包含所有节点
      group.proxies = [...otherProxies.map((p) => p.name)];
    }
    group.lazy = true;
    group.url = "https://www.google.com/generate_204"
    group.timeout = 5000
    group["max-failed-times"] = 3;
  });
  return config;
}

export async function preHandleClash(content) {
  const config = await yaml.load(content);
  const result = yaml.dump(handler(config, "CUNOE"))
  return result;
}