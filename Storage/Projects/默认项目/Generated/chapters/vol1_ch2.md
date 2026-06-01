# 第二章 审计员的封锁线

沈栀到达旧泵站时，雨还没有停。

她站在封锁线外，抬起袖口。三级审计印章在腕侧亮起，泵站残留的灵纹日志像细密蛛网一样浮在空气里。

日志显示：零点四十七分，旧泵站运行正常。

现场显示：零点四十七分，主阀门烧穿，三组管线过载，封锁指令被远程写入。

沈栀看着两份互相矛盾的证据，眉头轻轻皱起。

“林砚。”她念出维修单上的名字。

身后传来水声。

少年从退潮河道的阴影里爬上来，工装湿透，左眼接口还冒着细小电弧。他看见沈栀的制服，第一反应是后退半步。

“城主府的人？”林砚擦掉脸上的雨水，“来得真快。”

“我来得不算快。”沈栀抬起记录仪，“财团安保比我早三分钟下达了封锁命令。你最好解释一下，你为什么能在封锁前离开。”

林砚把右手插进口袋，指腹按住断裂符箓针。

“维修工会走下水道，很奇怪？”

“不奇怪。”沈栀向前一步，“奇怪的是官方日志被掐掉了三秒。那三秒里，只有你的义眼接口和一个未登记离线源同时亮过。”

林砚的眼神冷下来。

雨水敲在铁皮屋顶上，像密集的倒计时。远处，无人灯再次扫过浮桥。财团安保正在缩小搜索圈。

沈栀把记录仪翻给他看。屏幕上，第三潮汐塔的审计桥坐标与泵站残影重叠，蓝光边缘有无法伪造的时间抖动。

“我可以现在逮捕你。”她说。

林砚盯着她：“也可以把我交给财团。”

“我只交证据。”沈栀收起记录仪，“但现在证据在你身上。”

封锁线外传来扩音器声：“审计员沈栀，请移交嫌疑维修工。”

沈栀没有回头。她抬手，审计印章落下一道新的封锁，把财团安保隔在旧泵站外侧。

“带路。”她低声说，“去第三潮汐塔审计桥。”

林砚看了她很久，终于转身钻进雨幕。

“跟紧点，审计员。”他说，“下城区的路，不会给上城区的人第二次机会。”

沈栀迈过封锁线。

在她身后，官方日志自动刷新。缺失的三秒仍旧空白，像一只被挖掉的眼睛。

---CHANGES---
{
  "character_state_changes": [
    {
      "character_id": "char_linyan",
      "phase": "试探结盟",
      "level": "低阶雷纹术",
      "abilities": ["灵潮管线维修", "短暂读取离线符箓残影"],
      "mental_state": "戒备但开始承认需要帮助",
      "key_event": "同意带沈栀前往第三潮汐塔审计桥",
      "relationship_changes": [
        {
          "target_character_id": "char_shenzhi",
          "relation": "临时盟友",
          "trust": 32
        }
      ]
    },
    {
      "character_id": "char_shenzhi",
      "phase": "规则动摇",
      "level": "三级审计员",
      "abilities": ["审计封印", "日志追踪", "识别伪造灵纹日志"],
      "mental_state": "冷静外壳下开始怀疑官方记录",
      "key_event": "发现旧泵站官方日志缺失三秒",
      "relationship_changes": [
        {
          "target_character_id": "char_linyan",
          "relation": "临时盟友",
          "trust": 30
        }
      ]
    }
  ],
  "conflict_progress": [
    {
      "conflict_id": "conf_gray_whale_truth",
      "status": "active",
      "event": "日志缺失三秒"
    }
  ],
  "plot_points": [
    {
      "keywords": ["缺失三秒日志", "审计封锁", "临时同盟"],
      "context": "沈栀确认官方日志缺失三秒，与林砚形成临时同盟。",
      "involved_characters": ["char_linyan", "char_shenzhi"],
      "storyline": "灰鲸事故真相"
    }
  ],
  "foreshadowing_actions": [
    {
      "foreshadowing_id": "fs_missing_three_seconds",
      "action": "setup",
      "chapter_id": "vol1_ch2"
    }
  ],
  "location_state_changes": [
    {
      "location_id": "loc_lower_bridge",
      "status": "under-lockdown",
      "event": "沈栀以审计权限封锁旧泵站外围"
    }
  ],
  "faction_state_changes": [
    {
      "faction_id": "fac_tide_corp",
      "status": "exposed-suspicion",
      "event": "内部命令显示回收目标疑似林砚本人"
    }
  ],
  "timeline": {
    "time_period": "同夜后半段",
    "elapsed_time": "约2小时",
    "key_time_event": "沈栀封锁现场并与林砚达成临时同盟"
  },
  "character_movements": [
    {
      "character_id": "char_linyan",
      "from_location": "旧泵站",
      "to_location": "第三潮汐塔外围"
    },
    {
      "character_id": "char_shenzhi",
      "from_location": "城主府审计站",
      "to_location": "旧泵站"
    }
  ],
  "item_transfers": [
    {
      "item_name": "断裂符箓针",
      "from_holder": "林砚",
      "to_holder": "林砚",
      "status": "hidden"
    }
  ]
}
