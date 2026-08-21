CREATE TABLE `telegram_referral_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerTelegramUserId` varchar(32) NOT NULL,
	`qualifiedReferralCount` int NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`accessStartsAt` timestamp NOT NULL,
	`accessExpiresAt` timestamp NOT NULL,
	`revokedByAdminUserId` varchar(64),
	`revokedAt` timestamp,
	`revokeReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_referral_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerTelegramUserId` varchar(32) NOT NULL,
	`refereeTelegramUserId` varchar(32) NOT NULL,
	`refereeChatId` varchar(32) NOT NULL,
	`status` enum('pending','qualified','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`qualifiedAt` timestamp,
	`rejectedAt` timestamp,
	`rejectionReason` varchar(128),
	CONSTRAINT `telegram_referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_referrals_unique_referee` UNIQUE(`refereeTelegramUserId`)
);
