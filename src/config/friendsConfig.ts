import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "tuyi",
		imgurl: "https://avatars.githubusercontent.com/u/147691299?v=4",
		desc: "一只可爱的小南梁",
		siteurl: "https://blog.tuyiisxp.top/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
	},
	{
		title: "pai",
		imgurl: "https://raw.githubusercontent.com/wenject/tuchuang/main/20250305213320.png",
		desc: "一只有女朋友的小南梁",
		siteurl: "https://www.cnblogs.com/paaai",
		tags: ["Blog"],
		weight: 9,
		enabled: true,
	},
	{
		title: "Saki",
		imgurl: "https://azumisaki.github.io/img/3.png",
		desc: "一只可爱的男娘小学弟",
		siteurl: "https://azumisaki.github.io/",
		tags: ["Blog"],
		weight: 8,
		enabled: false,
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
