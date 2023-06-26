import {
    encodeAbiParameters,
    getContract,
    type Hex,
    parseAbi,
    parseAbiParameters,
    encodeFunctionData,
    type Hash
} from "viem";
import {polygonMumbai} from "viem/chains";
import { generatePrivateKey } from 'viem/accounts'
import {KernelBaseValidator, ValidatorMode} from "../validator/base";
import {type KernelSmartAccountParams, KernelSmartContractAccount} from "../account";
import {MockSigner} from "./mocks/mock-signer";
import {ZeroDevProvider} from "../provider";
import {PrivateKeySigner} from "@alchemy/aa-core";
import { TEST_ERC20Abi } from "../abis/Test_ERC20Abi";


describe("Kernel Account Tests", () => {
    
    //any wallet should work
    const config = {
        privateKey: process.env.PRIVATE_KEY as Hex ?? generatePrivateKey(),
        ownerWallet: process.env.OWNER_WALLET,
        mockWallet: "0x48D4d3536cDe7A257087206870c6B6E76e3D4ff4",
        chain: polygonMumbai,
        rpcProvider: "https://mumbai-bundler.etherspot.io/",
        validatorAddress: "0x180D6465F921C7E0DEA0040107D342c87455fFF5" as Hex,
        accountFactoryAddress: "0x5D006d3880645ec6e254E18C1F879DAC9Dd71A39" as Hex,
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as Hex,
        // Turn off all policies related to gas sponsorship for this projectId
        // To make all the testcases pass
        projectId: "8db3f9f0-f8d0-4c69-9bc6-5c522ee25844"
    }

    const owner = PrivateKeySigner.privateKeyToAccountSigner(config.privateKey)
    const mockOwner = new MockSigner()

    const validator: KernelBaseValidator = new KernelBaseValidator(({
        validatorAddress: config.validatorAddress,
        mode: ValidatorMode.sudo,
        owner
    }))

    const mockValidator: KernelBaseValidator = new KernelBaseValidator(({
        validatorAddress: config.validatorAddress,
        mode: ValidatorMode.sudo,
        owner: mockOwner
    }))


    const provider = new ZeroDevProvider({
        projectId: config.projectId,
        entryPointAddress: config.entryPointAddress,
        chain: config.chain,
        // By default uses ZeroDev meta-bundler
        // rpcUrl: config.rpcProvider
    })

    const kernelAddress = "0xD49a72cb78C44c6bfbf0d471581B7635cF62E81e"

    const kernelFactoryContract = getContract({
        address: kernelAddress,
        abi: parseAbi([
            'function getAccountAddress(address _owner, uint256 _index) public view returns (address)',
            ]),
        publicClient: provider.rpcClient,
    })

    function connect(index: bigint, owner=mockOwner) {
        return provider.connect((provider) => account(index,owner))
    }

    function account(index: bigint, owner=mockOwner) {
        const accountParams: KernelSmartAccountParams = {
            rpcClient: provider.rpcClient,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            owner: owner,
            factoryAddress: config.accountFactoryAddress,
            index: index,
            defaultValidator: owner === mockOwner ? mockValidator: validator,
            validator: owner === mockOwner ? mockValidator: validator
        }
        return new KernelSmartContractAccount(accountParams)
    }

    

    it("getAddress returns valid counterfactual address", async () => {

        //contract already deployed
        let signerWithProvider =  connect(0n)
        expect(await signerWithProvider.getAddress()).eql(
            "0x97925A25C6B8E8902D2c68A4fcd90421a701d2E8"
        );

        //contract already deployed
        signerWithProvider =  connect(3n)
        expect(await signerWithProvider.getAddress()).eql(
            "0xA7b2c01A5AfBCf1FAB17aCf95D8367eCcFeEb845"
        );

     },{timeout: 100000});


    it("getNonce returns valid nonce", async () => {

        //contract deployed but no transaction
        const signer:KernelSmartContractAccount =  account(0n)
        expect(await signer.getNonce()).eql(0n);

        const signer2:KernelSmartContractAccount =  account(3n)
        expect(await signer2.getNonce()).eql(2n);
    }, {timeout: 100000});

    it("encodeExecute returns valid encoded hash", async () => {
        const signer:KernelSmartContractAccount =  account(0n)
        expect(await signer.encodeExecute("0xA7b2c01A5AfBCf1FAB17aCf95D8367eCcFeEb845",1n,"0x234")).eql(
            "0x51945447000000000000000000000000a7b2c01a5afbcf1fab17acf95d8367eccfeeb84500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022340000000000000000000000000000000000000000000000000000000000000"
        );
    });


    it("encodeExecuteDelegate returns valid encoded hash", async () => {
        const signer:KernelSmartContractAccount =  account(0n)
        expect(await signer.encodeExecuteDelegate("0xA7b2c01A5AfBCf1FAB17aCf95D8367eCcFeEb845",1n,"0x234")).eql(
            "0x51945447000000000000000000000000a7b2c01a5afbcf1fab17acf95d8367eccfeeb84500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000022340000000000000000000000000000000000000000000000000000000000000"
        );
    });


    it("signWithEip6492 should correctly sign the message", async () => {
        const messageToBeSigned: Hex = "0xa70d0af2ebb03a44dcd0714a8724f622e3ab876d0aa312f0ee04823285d6fb1b"
        const magicBytes = "6492649264926492649264926492649264926492649264926492649264926492"
        const ownerSignedMessage = "0x4d61c5c27fb64b207cbf3bcf60d78e725659cff5f93db9a1316162117dff72aa631761619d93d4d97dfb761ba00b61f9274c6a4a76e494df644d968dd84ddcdb1c"
        const factoryCode = "0x296601cd000000000000000000000000180d6465f921c7e0dea0040107d342c87455fff50000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001448D4d3536cDe7A257087206870c6B6E76e3D4ff4000000000000000000000000"
        const signature = encodeAbiParameters(
                parseAbiParameters('address, bytes, bytes'),
                [config.accountFactoryAddress,factoryCode,ownerSignedMessage]
            ) + magicBytes

        const signer =  connect(0n)
        expect(await signer.request({ method: "personal_sign", params: [
                messageToBeSigned,
                await signer.getAddress()
            ]
        })).toBe(
            ownerSignedMessage
        );

        const signer2 =  connect(10n)
        expect(await signer2.request({ method: "personal_sign", params: [
                messageToBeSigned,
                await signer2.getAddress()
            ]
        })).toBe(
            signature
        );

    },{timeout: 100000});


    it("signMessage should correctly sign the message", async () => {
        const messageToBeSigned: Hex = "0xa70d0af2ebb03a44dcd0714a8724f622e3ab876d0aa312f0ee04823285d6fb1b"

        const signer:KernelSmartContractAccount =  account(0n)
        expect(await signer.signMessage(messageToBeSigned)).toBe(
            "0x000000004d61c5c27fb64b207cbf3bcf60d78e725659cff5f93db9a1316162117dff72aa631761619d93d4d97dfb761ba00b61f9274c6a4a76e494df644d968dd84ddcdb1c"
        );

        const signer2:KernelSmartContractAccount =  account(1000n)
        expect(await signer2.signMessage(messageToBeSigned)).toBe(
            "0x000000004d61c5c27fb64b207cbf3bcf60d78e725659cff5f93db9a1316162117dff72aa631761619d93d4d97dfb761ba00b61f9274c6a4a76e494df644d968dd84ddcdb1c"
        );
    });

    // NOTE - this test case will fail if the gas fee is sponsored
    it("sendUserOperation should fail to execute if gas fee not present", async () => {
        let signerWithProvider =  (connect(1001n, owner)).withZeroDevPaymasterAndData({policy: "VERIFYING_PAYMASTER"})
    
    
        const result = signerWithProvider.sendUserOperation({
            target: await signerWithProvider.getAddress(),
            data: "0x",
        });
        
        await expect(result).rejects.toThrowError("AA21 didn't pay prefund");
    }, {timeout: 100000});


    //NOTE - this test case will only work if you
    // have deposited some matic balance for counterfactual address at entrypoint

    it("sendUserOperation should execute properly", async () => {
        //
        let signerWithProvider =  connect(0n,owner)
    
        //to fix bug in old versions
        await signerWithProvider.account.getInitCode()
        const result = signerWithProvider.sendUserOperation({
            target: "0xA02CDdFa44B8C01b4257F54ac1c43F75801E8175", //await signerWithProvider.getAddress(),
            data: "0x",
            value: 0n
        });
        await expect(result).resolves.not.toThrowError();
        await signerWithProvider.waitForUserOperationTransaction((await result).hash as Hash);
    }, {timeout: 100000});

    it("sponsored sendUserOperation should execute properly", async () => {
        //
        const provider = new ZeroDevProvider({
            projectId: "b5486fa4-e3d9-450b-8428-646e757c10f6",
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            // By default uses ZeroDev meta-bundler
            // rpcUrl: config.rpcProvider
        })

        const accountParams: KernelSmartAccountParams = {
            rpcClient: provider.rpcClient,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            owner: owner,
            factoryAddress: config.accountFactoryAddress,
            index: 1002n,
            defaultValidator: validator,
            validator: validator
        }
        const account = new KernelSmartContractAccount(accountParams);
        let signerWithProvider = (await provider.connect((provider) => account)).withZeroDevPaymasterAndData({policy:"VERIFYING_PAYMASTER"});
        await signerWithProvider.account!.getInitCode()
    
        //to fix bug in old versions
        const result = signerWithProvider.sendUserOperation({
            target: "0xA02CDdFa44B8C01b4257F54ac1c43F75801E8175", //await signerWithProvider.getAddress(),
            data: "0x",
            value: 0n
        });
        await expect(result).resolves.not.toThrowError();
        await signerWithProvider.waitForUserOperationTransaction((await result).hash as Hash);
    }, {timeout: 100000});

    //NOTE - this test case will only work if you
    // have deposited some Stackup TEST_ERC20 balance for counterfactual address at entrypoint

    it('should pay for single transaction with ERC20 token', async () => {
        const provider = new ZeroDevProvider({
            projectId: config.projectId,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            // By default uses ZeroDev meta-bundler
            // rpcUrl: config.rpcProvider
        })

        const accountParams: KernelSmartAccountParams = {
            rpcClient: provider.rpcClient,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            owner: owner,
            factoryAddress: config.accountFactoryAddress,
            index: 0n,
            defaultValidator: validator,
            validator: validator
        }
        const account = new KernelSmartContractAccount(accountParams);
        let signerWithProvider = (await provider.connect((provider) => account)).withZeroDevPaymasterAndData({policy:"TOKEN_PAYMASTER", gasToken: "TEST_ERC20"});
        await signerWithProvider.account!.getInitCode()

        const mintData = encodeFunctionData({
            abi: TEST_ERC20Abi,
            args: [await signerWithProvider.getAddress(), "700000000000000000"],
            functionName: "mint"
        })
        const result = signerWithProvider.sendUserOperation({
            target: "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B", 
            data: mintData,
            value: 0n
        });

        await expect(result).resolves.not.toThrowError();

        await signerWithProvider.waitForUserOperationTransaction((await result).hash as Hash);
    }, {timeout: 100000});

    //NOTE - this test case will only work if you
    // have deposited some Stackup TEST_ERC20 balance for counterfactual address at entrypoint

    it('should pay for batch transaction with ERC20 token', async () => {
        const providerWithTokenPaymaster = new ZeroDevProvider({
            projectId: config.projectId,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            // By default uses ZeroDev meta-bundler
            // rpcUrl: config.rpcProvider
        })

        const accountParams: KernelSmartAccountParams = {
            rpcClient: provider.rpcClient,
            entryPointAddress: config.entryPointAddress,
            chain: config.chain,
            owner: owner,
            factoryAddress: config.accountFactoryAddress,
            index: 0n,
            defaultValidator: validator,
            validator: validator
        }
        const account = new KernelSmartContractAccount(accountParams);
        let signerWithProvider = (await providerWithTokenPaymaster.connect((provider) => account)).withZeroDevPaymasterAndData({policy:"TOKEN_PAYMASTER", gasToken: "TEST_ERC20"})
        await signerWithProvider.account!.getInitCode()

        const mintData = encodeFunctionData({
            abi: TEST_ERC20Abi,
            args: [await signerWithProvider.getAddress(), "133700000000000000"],
            functionName: "mint"
        })
        const transferData = encodeFunctionData({
            abi: TEST_ERC20Abi,
            args: [await owner.getAddress(), "133700000000"],
            functionName: "transfer"
        })
        const result = signerWithProvider.sendUserOperation([{
            target: "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B", 
            data: mintData,
            value: 0n
        }, {
            target: "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B",
            data: transferData,
            value: 0n
        }]);
        await expect(result).resolves.not.toThrowError();

    }, {timeout: 100000});



    //non core functions
    it("should correctly identify whether account is deployed", async () => {

        //contract already deployed
        const signer =  account(0n)
        expect(await signer.isAccountDeployed()).eql(true);

        //contract already deployed
        const signer2 =  account(3n)
        expect(await signer2.isAccountDeployed()).eql(true );

        //contract not deployed
        const signer3 =  account(4n)
        expect(await signer3.isAccountDeployed()).eql(false );

        //contract not deployed
        const signer4 =  account(5n)
        expect(await signer4.isAccountDeployed()).eql(false );
    },{timeout: 100000});

})