import { useCallback, useEffect, useState } from "react"
import { Contract, providers, Signer } from "ethers"

import { ChakraProvider, Container, Button, Box, HStack, VStack, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useBoolean } from "@chakra-ui/react"
import "@fontsource/inter/400.css"
import detectEthereumProvider from "@metamask/detect-provider"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, packToSolidityProof } from "@semaphore-protocol/proof"
import { formatBytes32String, hexlify, parseBytes32String } from "ethers/lib/utils"
import { createRoot } from "react-dom/client"
import Events from "../../contracts/build/contracts/contracts/Events.sol/Events.json"
import theme from "../styles"
import IconAddCircleFill from "./icons/IconAddCircleFill";

function App() {
    const [_loading, setLoading] = useBoolean()
    const [groups, setGroups] = useState<any[]>([])
    const [activeGroup, setActiveGroup] = useState<any>()
    const [users, setUsers] = useState<any[]>([])
    const [activeUser, setActiveUser] = useState<any>()
    const [activeGroup2, setActiveGroup2] = useState<any>()
    const [signer, setSigner] = useState<Signer>()
    const [contract, setContract] = useState<Contract>()

    const listenEvents = useCallback(async () => {
      if (!signer || !contract) {
          return []
      }

      const events = await contract.queryFilter(contract.filters.EventCreated())
      const members = await contract.queryFilter(contract.filters.MemberAdded())

      const _groups = events.map((e) => ({
          groupId: e.args![0].toString(),
          groupName: parseBytes32String(e.args![1]),
          members: members.filter((m) => m.args![0].eq(e.args![0])).map((m) => m.args![2].toString())
      }));
      setGroups(_groups);

      return true;
    }, [signer, contract])

    useEffect(() => {
        ;(async () => {
            const ethereum = (await detectEthereumProvider()) as any
            const accounts = await ethereum.request({ method: "eth_requestAccounts" })

            await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [
                    {
                        chainId: hexlify(Number(process.env.ETHEREUM_CHAIN_ID!)).replace("0x0", "0x")
                    }
                ]
            })

            const ethersProvider = new providers.Web3Provider(ethereum)

            if (accounts[0]) {
                setSigner(ethersProvider.getSigner())

                setContract(new Contract(process.env.CONTRACT_ADDRESS!, Events.abi, ethersProvider.getSigner()))
            }

            ethereum.on("accountsChanged", (newAccounts: string[]) => {
                if (newAccounts.length !== 0) {
                    setSigner(ethersProvider.getSigner())

                    setContract(new Contract(process.env.CONTRACT_ADDRESS!, Events.abi, ethersProvider.getSigner()))
                } else {
                    setSigner(undefined)
                }
            })

            await listenEvents();
        })()
    }, [])

    const createGroup = useCallback(async () => {
      if (signer && contract) {
          const groupName = window.prompt("Please enter your group name:")

          if (groupName) {
              setLoading.on()
              try {
                  const transaction = await contract.createEvent(formatBytes32String(groupName))

                  await transaction.wait()

                  await listenEvents();

              } catch (error) {
                  console.error(error)
              } finally {
                  setLoading.off()
              }
          }
      }
    }, [signer, contract])

    const createUser = useCallback(async () => {
        if (signer && contract) {
          if (!activeGroup) {
            alert("Please select a group first");
            return;
          }

          setLoading.on()
          try {
            const identity = new Identity();
            const tx = await contract.addMember(activeGroup.groupId, identity.generateCommitment().toString())

            await tx.wait()

            await listenEvents();

            const newUsers = [
              ...users,
              identity
            ]
            setUsers(newUsers);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading.off();
          }
        }
      },
      [signer, contract, activeGroup, users],
    )

    const tryLogin = useCallback(async () => {
      if (activeUser && activeGroup2) {

        const g = new Group()
        g.addMembers(activeGroup2.members)
        const { proof, publicSignals } = await generateProof(
          activeUser,
          g,
          activeGroup2.groupId,
          'login',
          {
              wasmFilePath: 'http://localhost:3000/artifacts/wasm',
              zkeyFilePath: 'http://localhost:3000/artifacts/zkey',
          }
        )
        const solidityProof = packToSolidityProof(proof)

        const { status } = await fetch(`${process.env.RELAY_URL}/post-review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                review: 'login',
                nullifierHash: publicSignals.nullifierHash,
                groupId: activeGroup2.groupId,
                solidityProof
            })
        })
        if (status === 200) {
          alert('Successfully logged in')
        } else {
          alert('Cannot login')
        }
      }
    }, [activeUser, activeGroup2, users])

    return (
        <>
          <Container marginTop='20'>
            <Tabs isFitted variant='enclosed'>
              <TabList>
                <Tab>Setup</Tab>
                <Tab>Playground</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <HStack justify="space-between">
                    <Text fontWeight='black' fontSize='2xl'>Groups</Text>
                    <Button
                      size='sm'
                      justifyContent="left"
                      colorScheme="primary"
                      px="4"
                      onClick={createGroup}
                      isDisabled={_loading}
                      leftIcon={<IconAddCircleFill />}
                    >
                      New
                    </Button>
                  </HStack>
                  <VStack alignItems="start" p="5" mb="10" borderWidth={1} borderColor="gray.500" borderRadius="4px">
                    {groups.map(group => (
                      <Text key={group.groupId}>{group.groupName} ({group.members.length})</Text>
                    ))}
                  </VStack>
                  <HStack justify="space-between">
                    <Text fontWeight='black' fontSize='2xl'>Users</Text>
                    <Select placeholder="Select a group" size='sm' width='200px' onChange={e => {
                      const groupId = e.target.value;
                      const group = groups.find(g => g.groupId === groupId);
                      setActiveGroup(group);
                    }}>
                      {groups.map(group => (
                        <option key={group.groupId} value={group.groupId}>{group.groupName}</option>
                      ))}
                    </Select>
                    <Button
                      size='sm'
                      justifyContent="left"
                      colorScheme="primary"
                      px="4"
                      onClick={createUser}
                      isDisabled={_loading}
                      leftIcon={<IconAddCircleFill />}
                    >
                      New
                    </Button>
                  </HStack>
                  <VStack alignItems="start" p="5" mb="5" borderWidth={1} borderColor="gray.500" borderRadius="4px">
                    {users && users.map((user, index) => (
                      <Text key={user.identity}>User {index+1}</Text>
                    ))}
                  </VStack>
                </TabPanel>
                <TabPanel>
                  <Box w="100%" py="6">
                    <VStack alignItems="start" p="5" borderWidth={1} borderColor="gray.500" borderRadius="4px">
                      <HStack justify="space-between" mb='3'>
                        <Select placeholder="Select a user" size='sm' width='200px' onChange={e => {
                          const index = Number(e.target.value);
                          const user = users[index]
                          setActiveUser(user);
                        }}>
                          {users && users.map((user, index) => (
                            <option key={index} value={index}>User {index+1}</option>
                          ))}
                        </Select>
                        <Select placeholder="Select a group" size='sm' width='200px' onChange={e => {
                          const groupId = e.target.value;
                          const group = groups.find(g => g.groupId === groupId);
                          setActiveGroup2(group);
                        }}>
                          {groups.map(group => (
                            <option key={group.groupId} value={group.groupId}>{group.groupName}</option>
                          ))}
                        </Select>
                      </HStack>
                      <Button
                        size='sm'
                        justifyContent="left"
                        colorScheme="primary"
                        px="4"
                        onClick={tryLogin}
                        isDisabled={_loading}
                      >
                        Try Login
                      </Button>
                    </VStack>
                  </Box>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Container>
        </>
    )
}

const root = createRoot(document.getElementById("app")!)

root.render(
    <ChakraProvider theme={theme}>
        <App />
    </ChakraProvider>
)
