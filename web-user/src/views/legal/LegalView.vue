<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

interface Section {
  heading: string
  paragraphs: string[]
}

interface LegalDoc {
  title: string
  updatedAt: string
  intro: string
  sections: Section[]
}

const PRIVACY: LegalDoc = {
  title: '隐私政策',
  updatedAt: '2026-10-10',
  intro:
    '时脉书社（以下简称"我们"）非常重视你的个人信息与隐私保护。本政策说明我们在你使用本服务时如何收集、使用、存储和保护你的个人信息，以及你享有的权利。请在使用前仔细阅读。',
  sections: [
    {
      heading: '一、我们收集的信息',
      paragraphs: [
        '我们遵循"最小必要"原则，仅收集实现下述功能所必需的信息，不收集与你使用服务无关的个人信息。',
        '1. 账号信息：手机号、昵称、头像、性别、个人简介。手机号用于账号注册、登录与找回。',
        '2. 使用信息：阅读场次与时长、书架、书评、动态、书单、点赞与评论等你在平台内产生的行为数据。',
        '3. 设备与日志信息：设备型号、操作系统、IP 地址、访问时间等，用于保障服务安全与故障排查。',
      ],
    },
    {
      heading: '二、我们如何使用信息',
      paragraphs: [
        '1. 提供核心功能：账号体系、阅读记录、时脉报告、社区互动与会员服务。',
        '2. 保障安全：识别异常登录、防刷与风控、内容安全审核。',
        '3. 改进产品：以去标识化、汇总方式分析使用情况，优化体验。',
      ],
    },
    {
      heading: '三、信息的存储与保护',
      paragraphs: [
        '1. 存储地点：你的信息存储于中华人民共和国境内的服务器。',
        '2. 存储期限：在你使用服务期间及法律法规要求的必要期限内保留。',
        '3. 安全措施：全站 HTTPS 传输、敏感信息脱敏展示、访问权限最小化、数据库每日备份。',
      ],
    },
    {
      heading: '四、信息共享与披露',
      paragraphs: [
        '1. 我们不会向第三方出售你的个人信息。',
        '2. 仅在以下情形共享：获得你的明确同意；法律法规要求；为提供短信验证等必要服务而委托的合作方（受保密义务约束）。',
      ],
    },
    {
      heading: '五、你的权利',
      paragraphs: [
        '1. 查阅与更正：你可在"个人中心"查看并编辑昵称、头像、性别、简介等资料。',
        '2. 删除与注销：你可在"个人中心 → 注销账号"提交注销申请。注销后账号将无法登录，相关数据将被删除或匿名化处理，该操作不可撤销。',
        '3. 撤回同意：你可通过注销账号撤回对信息处理的同意。',
      ],
    },
    {
      heading: '六、未成年人保护',
      paragraphs: [
        '本服务面向成年人。若你是未成年人，请在监护人陪同下阅读本政策，并在监护人同意后使用本服务。',
      ],
    },
    {
      heading: '七、政策更新与联系我们',
      paragraphs: [
        '本政策可能适时更新，更新后将在本页面公示生效日期。如对本政策有任何疑问，请通过平台内反馈渠道联系我们。',
      ],
    },
  ],
}

const TERMS: LegalDoc = {
  title: '用户协议',
  updatedAt: '2026-10-07',
  intro:
    '欢迎使用时脉书社。本协议是你与我们之间就使用本服务达成的约定。你注册、登录或使用本服务，即视为你已阅读并同意本协议全部条款。',
  sections: [
    {
      heading: '一、账号与安全',
      paragraphs: [
        '1. 你应使用真实、有效的手机号注册账号，并对账号下的所有行为负责。',
        '2. 请妥善保管账号凭证，因保管不善导致的损失由你自行承担。',
        '3. 禁止将账号转让、出借或与他人共享。',
      ],
    },
    {
      heading: '二、用户行为规范',
      paragraphs: [
        '1. 你发布的书评、评论、动态、书单等内容应合法合规，不得含有违法违规、侵权、虚假或不良信息。',
        '2. 禁止发布广告、垃圾信息、恶意刷量，或以技术手段干扰平台正常运行。',
        '3. 平台对内容实行机器审核与人工审核，违规内容将被驳回、下架，情节严重的将限制或封禁账号。',
      ],
    },
    {
      heading: '三、内容与知识产权',
      paragraphs: [
        '1. 你对自己发布的内容享有相应权利，并授予平台在服务范围内展示、存储与分发的非独占许可。',
        '2. 平台提供的书籍信息、界面设计、商标等知识产权归我们或相应权利人所有，未经许可不得使用。',
      ],
    },
    {
      heading: '四、会员与付费',
      paragraphs: [
        '1. 会员为增值服务，具体权益以购买页面说明为准。',
        '2. 兑换码为一次性核销凭证，一经使用不可退回。',
        '3. 因平台原因导致服务无法提供的，我们将依法妥善处理。',
      ],
    },
    {
      heading: '五、服务变更与终止',
      paragraphs: [
        '1. 我们可能对服务进行升级、调整或暂停，并将尽合理努力提前告知。',
        '2. 你可随时通过"个人中心 → 注销账号"终止本协议。注销后你将无法登录，相关数据将按隐私政策处理。',
        '3. 若你严重违反本协议，我们有权限制或终止向你提供服务。',
      ],
    },
    {
      heading: '六、免责与责任限制',
      paragraphs: [
        '1. 因不可抗力、网络故障、第三方服务等非平台可控因素导致的服务中断，平台不承担责任，但将尽力恢复。',
        '2. 你在平台获取的书籍信息、用户内容仅供参考，平台不对其准确性作绝对保证。',
      ],
    },
    {
      heading: '七、其他',
      paragraphs: [
        '本协议的订立、履行与争议解决适用中华人民共和国法律。条款更新后将在本页面公示，继续使用即视为接受更新后的协议。',
      ],
    },
  ],
}

const doc = computed<LegalDoc>(() => (route.name === 'terms' ? TERMS : PRIVACY))
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <article class="max-w-2xl mx-auto rounded-lg bg-paper-elevated shadow-level-1 border border-hairline p-lg md:p-xl">
        <RouterLink to="/" class="text-body-sm text-ink-muted hover:text-pine-deep">← 返回首页</RouterLink>

        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep mt-md">
          {{ doc.title }}
        </h1>
        <p class="text-label-sm text-ink-faint mt-2xs">生效日期：{{ doc.updatedAt }}</p>

        <p class="text-body-md text-ink-secondary mt-lg leading-relaxed">{{ doc.intro }}</p>

        <section v-for="(s, i) in doc.sections" :key="i" class="mt-lg">
          <h2 class="text-title-md text-ink-primary font-medium">{{ s.heading }}</h2>
          <p
            v-for="(p, j) in s.paragraphs"
            :key="j"
            class="text-body-md text-ink-secondary mt-sm leading-relaxed"
          >
            {{ p }}
          </p>
        </section>

        <div class="mt-xl pt-lg border-t border-hairline flex flex-wrap gap-md text-body-sm">
          <RouterLink to="/help" class="text-pine-deep hover:underline">帮助中心</RouterLink>
          <RouterLink to="/feedback" class="text-pine-deep hover:underline">意见反馈</RouterLink>
          <RouterLink to="/about" class="text-pine-deep hover:underline">关于我们</RouterLink>
          <RouterLink to="/privacy" class="text-pine-deep hover:underline">隐私政策</RouterLink>
          <RouterLink to="/terms" class="text-pine-deep hover:underline">用户协议</RouterLink>
        </div>
      </article>
    </div>
  </main>
</template>
